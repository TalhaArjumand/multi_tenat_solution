import os
import json
import boto3
import urllib.parse
import urllib.request
from botocore.exceptions import ClientError
from role_mapping import get_role_arn

dynamodb = boto3.resource('dynamodb')
customers_table = dynamodb.Table(os.environ.get('CUSTOMERS_TABLE', ''))
requests_table = dynamodb.Table(os.environ.get('REQUESTS_TABLE_NAME', ''))
sts_client = boto3.client('sts')


def get_customer_by_account_id(account_id):
    """Scan the Customers table for an established customer containing the given accountId."""
    try:
        response = customers_table.scan(
            FilterExpression='contains(accountIds, :acctId) AND roleStatus = :status',
            ExpressionAttributeValues={
                ':acctId': account_id,
                ':status': 'established'
            }
        )
        items = response.get('Items', [])
        if items:
            return items[0]
        return None
    except Exception as e:
        print(f"Error scanning Customers table: {e}")
        return None


def generate_console_url(credentials):
    """Generate an AWS Console federation URL from STS credentials.

    For assumed-role credentials, omit SessionDuration and let federation
    inherit the credential expiry.
    """
    url_creds = {
        'sessionId': credentials['AccessKeyId'],
        'sessionKey': credentials['SecretAccessKey'],
        'sessionToken': credentials['SessionToken']
    }
    json_string = json.dumps(url_creds)

    signin_url = (
        "https://signin.aws.amazon.com/federation"
        "?Action=getSigninToken"
        f"&Session={urllib.parse.quote_plus(json_string)}"
    )

    req = urllib.request.Request(signin_url)
    with urllib.request.urlopen(req) as response:
        signin_token = json.loads(response.read().decode())['SigninToken']

    console_url = (
        "https://signin.aws.amazon.com/federation"
        "?Action=login"
        "&Issuer=CloudIQS-MSP"
        f"&Destination={urllib.parse.quote_plus('https://console.aws.amazon.com/')}"
        f"&SigninToken={signin_token}"
    )
    return console_url


def handler(event, context):
    """
    Multi-tenant grant handler. Called by the Grant Step Function.
    If the request is for a multi-tenant customer, assumes the cross-account role
    and returns credentials. Otherwise, returns isMultiTenant=False so the Step Function
    falls back to the existing SSO path.
    """
    print(f"EVENT: {json.dumps(event)}")

    try:
        account_id = event.get('accountId', '')
        role_id = event.get('roleId', '')

        # Check if this is a multi-tenant request
        if not role_id.startswith('mt-'):
            # Not multi-tenant, fall back to SSO
            return {**event, 'isMultiTenant': False, 'useSSO': True}

        role_name = role_id.replace('mt-', '')

        # Look up the customer
        customer = get_customer_by_account_id(account_id)
        if not customer:
            print(f"No established customer found for account {account_id}")
            return {**event, 'isMultiTenant': False, 'useSSO': True}

        external_id = customer.get('externalId', '')
        if not external_id:
            print(f"Customer found but no externalId for account {account_id}")
            return {**event, 'isMultiTenant': False, 'useSSO': True}

        # Build the role ARN
        role_arn = get_role_arn(account_id, role_name)

        # Build session name
        username = event.get('username', 'unknown')
        session_name = f"{username[:20]}-{role_name}"[:64]

        # Calculate duration (event duration is in seconds)
        duration_seconds = min(int(event.get('duration', 3600)), 43200)

        # Assume the cross-account role
        assume_params = {
            'RoleArn': role_arn,
            'RoleSessionName': session_name,
            'ExternalId': external_id,
            'DurationSeconds': duration_seconds
        }

        print(f"Assuming role {role_arn} with ExternalId")
        assume_response = sts_client.assume_role(**assume_params)

        creds = assume_response['Credentials']

        # Generate console URL
        console_url = generate_console_url(creds)

        # Return enriched event for the Step Function
        result = {
            **event,
            'isMultiTenant': True,
            'useSSO': False,
            'multiTenantCredentials': {
                'consoleUrl': console_url,
                'accessKeyId': creds['AccessKeyId'],
                'expiration': creds['Expiration'].isoformat()
            },
            'grant': {
                'AccountAssignmentCreationStatus': {
                    'Status': 'IN_PROGRESS'
                }
            }
        }

        print(f"Successfully assumed role for multi-tenant customer in account {account_id}")
        return result

    except ClientError as e:
        print(f"AWS ClientError in multi-tenant grant: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error in multi-tenant grant: {e}")
        raise
