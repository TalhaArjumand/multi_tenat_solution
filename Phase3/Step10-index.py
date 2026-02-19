import os
import json
import boto3
import urllib.parse
import urllib.request
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
customers_table = dynamodb.Table(os.environ['CUSTOMERS_TABLE'])
requests_table = dynamodb.Table(os.environ['REQUESTS_TABLE'])
sts_client = boto3.client('sts')

ROLE_NAME_MAP = {
    'ReadOnlyAccess': 'CloudIQS-MSP-ReadOnlyRole',
    'S3FullAccess': 'CloudIQS-MSP-S3AdminRole',
    'EC2FullAccess': 'CloudIQS-MSP-EC2AdminRole',
    'PowerUserAccess': 'CloudIQS-MSP-PowerUserRole',
    'AdministratorAccess': 'CloudIQS-MSP-AdminRole',
    'DatabaseAdmin': 'CloudIQS-MSP-DatabaseAdminRole',
    'NetworkAdmin': 'CloudIQS-MSP-NetworkAdminRole',
    'SecurityAudit': 'CloudIQS-MSP-SecurityAuditRole',
}


def handler(event, context):
    print(f"EVENT: {json.dumps(event)}")
    
    args = event.get('arguments', event)
    request_id = args.get('requestId')
    access_type = args.get('accessType', 'console')
    username = event.get('identity', {}).get('username', '')
    
    # Get the request
    try:
        req_response = requests_table.get_item(Key={'id': request_id})
        request = req_response.get('Item')
        if not request:
            return {'error': 'Request not found'}
        
        # Verify the requester owns this request
        if request.get('owner') != username and username not in (request.get('approver_ids') or []):
            return {'error': 'Unauthorized'}
        
        # Verify request is active
        if request.get('status') != 'in progress':
            return {'error': f'Request is not active (status: {request.get("status")})'}
        
        account_id = request['accountId']
        role_id = request.get('roleId', '')
        role_name = role_id.replace('mt-', '') if role_id.startswith('mt-') else role_id
        
        # Get customer for this account
        scan_response = customers_table.scan(
            FilterExpression='contains(accountIds, :acctId) AND roleStatus = :status',
            ExpressionAttributeValues={
                ':acctId': account_id,
                ':status': 'established'
            }
        )
        
        if not scan_response.get('Items'):
            return {'error': f'No established customer found for account {account_id}'}
        
        customer = scan_response['Items'][0]
        external_id = customer['externalId']
        
        # Build role ARN
        iam_role_name = ROLE_NAME_MAP.get(role_name, 'CloudIQS-MSP-AccessRole')
        role_arn = f"arn:aws:iam::{account_id}:role/{iam_role_name}"
        
        # Assume role
        session_name = f"{username.split('@')[0] if '@' in username else username[:20]}-{role_name}"[:64]
        
        assume_response = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=session_name,
            ExternalId=external_id,
            DurationSeconds=3600  # 1 hour per session
        )
        
        creds = assume_response['Credentials']
        
        if access_type == 'console':
            # Generate console federation URL
            url_creds = {
                'sessionId': creds['AccessKeyId'],
                'sessionKey': creds['SecretAccessKey'],
                'sessionToken': creds['SessionToken']
            }
            json_string = json.dumps(url_creds)
            
            signin_url = f"https://signin.aws.amazon.com/federation?Action=getSigninToken&SessionDuration=43200&Session={urllib.parse.quote_plus(json_string)}"
            req = urllib.request.Request(signin_url)
            with urllib.request.urlopen(req) as response:
                signin_token = json.loads(response.read().decode())['SigninToken']
            
            console_url = (
                f"https://signin.aws.amazon.com/federation"
                f"?Action=login"
                f"&Issuer=CloudIQS-MSP"
                f"&Destination={urllib.parse.quote_plus('https://console.aws.amazon.com/')}"
                f"&SigninToken={signin_token}"
            )
            
            return {
                'consoleUrl': console_url,
                'expiration': creds['Expiration'].isoformat()
            }
        else:
            # CLI credentials
            return {
                'accessKeyId': creds['AccessKeyId'],
                'secretAccessKey': creds['SecretAccessKey'],
                'sessionToken': creds['SessionToken'],
                'expiration': creds['Expiration'].isoformat()
            }
            
    except ClientError as e:
        print(f"Error: {e}")
        return {'error': str(e)}
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {'error': str(e)}