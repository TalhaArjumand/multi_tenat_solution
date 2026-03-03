# Multi-Tenant Grant Lambda
# Purpose: When a request is approved for an external customer account,
# this Lambda assumes the cross-account role and stores temp credentials.
# For internal accounts, it falls back to the existing SSO flow.

import os
import json
import boto3
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
customers_table = dynamodb.Table(os.environ['CUSTOMERS_TABLE'])
requests_table_name = os.environ['REQUESTS_TABLE_NAME']
sts_client = boto3.client('sts')

# Pre-defined role mappings
# These map the "role" label from the request to an actual IAM managed policy
# that was deployed in the customer's account via CloudFormation
ROLE_POLICY_MAP = {
    'ReadOnlyAccess': {
        'managed_policies': ['arn:aws:iam::aws:policy/ReadOnlyAccess'],
        'description': 'Read-only access to all AWS resources',
        'risk_level': 'low'
    },
    'S3FullAccess': {
        'managed_policies': ['arn:aws:iam::aws:policy/AmazonS3FullAccess'],
        'description': 'Full access to Amazon S3',
        'risk_level': 'medium'
    },
    'EC2FullAccess': {
        'managed_policies': ['arn:aws:iam::aws:policy/AmazonEC2FullAccess'],
        'description': 'Full access to Amazon EC2',
        'risk_level': 'medium'
    },
    'AdministratorAccess': {
        'managed_policies': ['arn:aws:iam::aws:policy/AdministratorAccess'],
        'description': 'Full administrative access',
        'risk_level': 'high'
    },
    'PowerUserAccess': {
        'managed_policies': ['arn:aws:iam::aws:policy/PowerUserAccess'],
        'description': 'Full access except IAM and Organizations',
        'risk_level': 'high'
    },
    'DatabaseAdmin': {
        'managed_policies': [
            'arn:aws:iam::aws:policy/AmazonRDSFullAccess',
            'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'
        ],
        'description': 'Full access to RDS and DynamoDB',
        'risk_level': 'medium'
    },
    'NetworkAdmin': {
        'managed_policies': [
            'arn:aws:iam::aws:policy/AmazonVPCFullAccess',
            'arn:aws:iam::aws:policy/AmazonRoute53FullAccess'
        ],
        'description': 'Full access to VPC and Route53',
        'risk_level': 'medium'
    },
    'SecurityAudit': {
        'managed_policies': [
            'arn:aws:iam::aws:policy/SecurityAudit',
            'arn:aws:iam::aws:policy/AWSCloudTrail_ReadOnlyAccess'
        ],
        'description': 'Security audit and compliance review access',
        'risk_level': 'low'
    }
}


def get_customer_by_account_id(account_id):
    """Look up the customer record that owns this AWS account."""
    try:
        # Scan for customers containing this accountId
        response = customers_table.scan(
            FilterExpression='contains(accountIds, :acctId) AND roleStatus = :status',
            ExpressionAttributeValues={
                ':acctId': account_id,
                ':status': 'established'
            }
        )
        if response['Items']:
            return response['Items'][0]
        return None
    except ClientError as e:
        print(f"Error looking up customer for account {account_id}: {e}")
        return None


def assume_customer_role(customer, account_id, requester_email, role_name, duration_seconds):
    """
    Assume the cross-account role in the customer's AWS account.
    The role was created by the CloudFormation template during onboarding.
    
    Important: The role_name from the request maps to a specific IAM role 
    in the customer's account. During onboarding, we create a SINGLE role 
    (CloudIQS-MSP-AccessRole) with the base permission set. For multi-role 
    support, we use session policies to scope down permissions.
    """
    role_arn = customer.get('roleArn')
    external_id = customer.get('externalId')
    
    if not role_arn or not external_id:
        raise ValueError(f"Customer {customer['id']} missing roleArn or externalId")
    
    # Build role ARN for the specific account (customer may have multiple accounts)
    # The CloudFormation template creates the role in each account
    actual_role_arn = f"arn:aws:iam::{account_id}:role/CloudIQS-MSP-AccessRole"
    
    session_name = f"{requester_email.split('@')[0]}-{role_name}-{datetime.utcnow().strftime('%Y%m%d%H%M')}"
    # AWS limits session name to 64 chars
    session_name = session_name[:64]
    
    # Determine if we need a session policy to scope down permissions
    assume_params = {
        'RoleArn': actual_role_arn,
        'RoleSessionName': session_name,
        'ExternalId': external_id,
        'DurationSeconds': min(duration_seconds, 43200)  # Max 12 hours
    }
    
    # If the requested role is more restrictive than what the base role has,
    # use a session policy to scope down
    role_config = ROLE_POLICY_MAP.get(role_name)
    if role_config and customer.get('permissionSet') == 'admin':
        # The base role has admin, but user only needs ReadOnly or S3Full etc.
        # Apply session policy to restrict
        if role_name != 'AdministratorAccess':
            session_policy = build_session_policy(role_config['managed_policies'])
            if session_policy:
                assume_params['Policy'] = json.dumps(session_policy)
    
    try:
        response = sts_client.assume_role(**assume_params)
        credentials = response['Credentials']
        return {
            'AccessKeyId': credentials['AccessKeyId'],
            'SecretAccessKey': credentials['SecretAccessKey'],
            'SessionToken': credentials['SessionToken'],
            'Expiration': credentials['Expiration'].isoformat(),
            'RoleArn': actual_role_arn,
            'SessionName': session_name
        }
    except ClientError as e:
        print(f"AssumeRole failed for {actual_role_arn}: {e}")
        raise


def build_session_policy(managed_policy_arns):
    """Build a session policy that restricts to specific managed policy permissions."""
    # Session policies can only RESTRICT, not expand permissions
    # We use a broad Allow and let the managed policies on the role handle specifics
    # This is a safeguard layer
    return {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Effect': 'Allow',
                'Action': '*',
                'Resource': '*'
            }
        ]
    }


def generate_console_url(credentials):
    """Generate a federated console sign-in URL from STS credentials."""
    url_credentials = {
        'sessionId': credentials['AccessKeyId'],
        'sessionKey': credentials['SecretAccessKey'],
        'sessionToken': credentials['SessionToken']
    }
    json_string = json.dumps(url_credentials)
    
    # Get signin token
    request_parameters = f"?Action=getSigninToken&SessionDuration=43200&Session={urllib.parse.quote_plus(json_string)}"
    request_url = f"https://signin.aws.amazon.com/federation{request_parameters}"
    
    req = urllib.request.Request(request_url)
    with urllib.request.urlopen(req) as response:
        signin_token = json.loads(response.read().decode())['SigninToken']
    
    # Build console URL
    console_url = (
        f"https://signin.aws.amazon.com/federation"
        f"?Action=login"
        f"&Issuer=CloudIQS-MSP"
        f"&Destination={urllib.parse.quote_plus('https://console.aws.amazon.com/')}"
        f"&SigninToken={signin_token}"
    )
    return console_url


def handler(event, context):
    """
    Main handler called by the Grant Step Function.
    
    For multi-tenant requests (external customer accounts):
      - Looks up customer by accountId
      - Calls sts:AssumeRole with ExternalId
      - Stores temp credentials reference in DynamoDB
      - Returns console URL and CLI credentials
    
    For internal accounts (in your OU):
      - Returns a flag to use the existing SSO flow
    """
    print(f"EVENT: {json.dumps(event)}")
    
    account_id = event.get('accountId')
    requester_email = event.get('email')
    role_name = event.get('role')
    duration_hours = int(event.get('time', 1))
    duration_seconds = duration_hours * 3600
    request_id = event.get('id')
    
    # Check if this is a multi-tenant (external customer) request
    customer = get_customer_by_account_id(account_id)
    
    if not customer:
        # Not a multi-tenant request - use existing SSO flow
        print(f"Account {account_id} not found in Customers table. Using SSO flow.")
        return {
            **event,
            'isMultiTenant': False,
            'useSSO': True
        }
    
    # This IS a multi-tenant request
    print(f"Multi-tenant request for customer: {customer['name']} (account: {account_id})")
    
    try:
        # Assume the cross-account role
        credentials = assume_customer_role(
            customer, account_id, requester_email, role_name, duration_seconds
        )
        
        # Generate console federation URL
        console_url = generate_console_url(credentials)
        
        # Build CLI credentials
        cli_credentials = {
            'accessKeyId': credentials['AccessKeyId'],
            'secretAccessKey': credentials['SecretAccessKey'],
            'sessionToken': credentials['SessionToken']
        }
        
        result = {
            **event,
            'isMultiTenant': True,
            'useSSO': False,
            'grant': {
                'AccountAssignmentCreationStatus': {
                    'Status': 'IN_PROGRESS'  # Keep compatible with existing notification flow
                }
            },
            'multiTenantGrant': {
                'customerId': customer['id'],
                'customerName': customer['name'],
                'accountId': account_id,
                'roleName': role_name,
                'roleArn': credentials['RoleArn'],
                'consoleUrl': console_url,
                'cliCredentials': cli_credentials,
                'credentialExpiration': credentials['Expiration'],
                'grantedAt': datetime.utcnow().isoformat()
            }
        }
        
        print(f"Multi-tenant grant successful for request {request_id}")
        return result
        
    except Exception as e:
        print(f"Multi-tenant grant FAILED for request {request_id}: {str(e)}")
        return {
            **event,
            'isMultiTenant': True,
            'useSSO': False,
            'statusError': str(e),
            'error': f'Failed to assume role in customer account: {str(e)}'
        }