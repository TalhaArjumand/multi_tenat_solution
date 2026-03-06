import os
import json
import boto3
import urllib.parse
import urllib.request
from botocore.exceptions import ClientError
from role_mapping import get_role_arn

dynamodb = boto3.resource('dynamodb')
customers_table = dynamodb.Table(os.environ.get('CUSTOMERS_TABLE', ''))
requests_table = dynamodb.Table(os.environ.get('REQUESTS_TABLE', ''))
sts_client = boto3.client('sts')


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
    On-demand credential generation for active multi-tenant requests.
    Called via AppSync GraphQL resolver.
    """
    print(f"EVENT: {json.dumps(event)}")

    try:
        args = event.get('arguments', event)
        request_id = args.get('requestId')
        access_type = args.get('accessType', 'console')
        username = event.get('identity', {}).get('username', '')

        if not request_id:
            return {'error': 'requestId is required'}

        # Get the request
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

        # Use the request's authoritative customer context instead of scanning by account.
        customer_id = request.get('customerId')
        if not customer_id:
            return {'error': 'Request is missing customerId'}

        customer_response = customers_table.get_item(Key={'id': customer_id})
        customer = customer_response.get('Item')
        if not customer:
            return {'error': f'Customer not found (customerId: {customer_id})'}

        if customer.get('roleStatus') != 'established':
            return {'error': f'Customer role is not established (customerId: {customer_id})'}

        account_ids = [str(customer_account_id) for customer_account_id in (customer.get('accountIds') or [])]
        if str(account_id) not in account_ids:
            return {'error': f'Account/customer mismatch (accountId: {account_id}, customerId: {customer_id})'}

        external_id = customer.get('externalId')
        if not external_id:
            return {'error': f'Customer missing externalId (customerId: {customer_id})'}

        # Build role ARN
        role_arn = get_role_arn(account_id, role_name)

        # Assume role
        session_name = f"{username.split('@')[0] if '@' in username else username[:20]}-{role_name}"[:64]

        assume_response = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=session_name,
            ExternalId=external_id,
            DurationSeconds=3600
        )

        creds = assume_response['Credentials']

        if access_type == 'console':
            console_url = generate_console_url(creds)
            return {
                'consoleUrl': console_url,
                'expiration': creds['Expiration'].isoformat()
            }
        else:
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
