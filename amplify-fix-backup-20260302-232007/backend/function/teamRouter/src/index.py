# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import os
import json
import boto3
import requests
from botocore.exceptions import ClientError
from requests_aws_sign import AWSV4Sign
import asyncio
from botocore.config import Config
from boto3.dynamodb.conditions import Attr
    
policy_table_name = os.getenv("POLICY_TABLE_NAME")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
requests_table_name = os.getenv("REQUESTS_TABLE_NAME")
customers_table_name = os.getenv("CUSTOMERS_TABLE_NAME")
user_pool_id = os.getenv("AUTH_TEAM06DBB7FC_USERPOOLID")
dynamodb = boto3.resource('dynamodb')
policy_table = dynamodb.Table(policy_table_name)
settings_table = dynamodb.Table(settings_table_name)
customers_table = dynamodb.Table(customers_table_name)

grant = os.getenv("GRANT_SM")
revoke = os.getenv("REVOKE_SM")
reject = os.getenv("REJECT_SM")
schedule = os.getenv("SCHEDULE_SM")
approval = os.getenv("APPROVAL_SM")
notification_topic_arn = os.getenv("NOTIFICATION_TOPIC_ARN")
sso_login_url = os.getenv("SSO_LOGIN_URL")
fn_teamstatus_arn = os.getenv("FN_TEAMSTATUS_ARN")
fn_teamnotifications_arn = os.getenv("FN_TEAMNOTIFICATIONS_ARN")
team_config = {
    "sso_login_url": sso_login_url,
    "requests_table": requests_table_name,
    "revoke_sm": revoke,
    "grant_sm": grant,
    "fn_teamstatus_arn": fn_teamstatus_arn,
    "fn_teamnotifications_arn": fn_teamnotifications_arn,
}



def list_account_for_ou(ouId):
    account = []
    client = boto3.client('organizations')
    try:
        p = client.get_paginator('list_accounts_for_parent')
        paginator = p.paginate(ParentId=ouId,)

        for page in paginator:
            for acct in page['Accounts']:
                account.extend([{"name": acct['Name'], 'id':acct['Id']}])
        return account
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_entitlements(id):
    response = policy_table.get_item(
        Key={
            'id': id
        }
    )
    return response


def get_settings():
    response = settings_table.get_item(
        Key={
            'id': 'settings'
        }
    )
    return response

def getEntitlements(userId, groupIds):
    eligibility = []
    maxDuration = 0
    for id in [userId] + groupIds:
        if not id:
            continue
        entitlement = get_entitlements(id)
        if "Item" not in entitlement.keys():
            continue
        duration = entitlement['Item']['duration']
        if int(duration) > maxDuration:
            maxDuration = int(duration)
        policy = {}
        policy['accounts'] = entitlement['Item']['accounts']
        
        for ou in entitlement["Item"]["ous"]:
            data = list_account_for_ou(ou["id"])
            policy['accounts'].extend(data)
            
        policy['permissions'] = entitlement['Item']['permissions']
        policy['approvalRequired'] = entitlement['Item']['approvalRequired']
        policy['duration'] = str(maxDuration)
        
        eligibility.append(policy)

    return eligibility

def list_idc_group_membership(userId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_group_memberships_for_member')
        paginator = p.paginate(IdentityStoreId=sso_instance['IdentityStoreId'],
            MemberId={
                'UserId': userId
            })
        all_idc_groups = []
        for page in paginator:
            all_idc_groups.extend(page["GroupMemberships"])
        return all_idc_groups
    except ClientError as e:
        print(e.response['Error']['Message'])
        return []

def updateRequest(input):
    session = boto3.session.Session()
    credentials = session.get_credentials()
    credentials = credentials.get_frozen_credentials()
    region = session.region_name

    input = input
    query = """
        mutation UpdateRequests(
            $input: UpdateRequestsInput!
            $condition: ModelRequestsConditionInput
        ) {
            updateRequests(input: $input, condition: $condition) {
            id
            email
            accountId
            accountName
            role
            roleId
            startTime
            duration
            justification
            status
            comment
            username
            approver
            approverId
            approvers
            approver_ids
            revoker
            revokerId
            endTime
            ticketNo
            revokeComment
            createdAt
            updatedAt
            owner
            customerId
            customerName
            assignmentPrincipalId
            assignmentPrincipalType
            assignmentRequestId
            activationError
            activationStartedAt
            activationCompletedAt
            revocationCompletedAt
            }
        }
    """

    endpoint = os.environ.get('API_TEAM_GRAPHQLAPIENDPOINTOUTPUT', None)
    headers = {"Content-Type": "application/json"}
    payload = {"query": query, 'variables': {'input': input}}

    appsync_region = region
    auth = AWSV4Sign(credentials, appsync_region, 'appsync')

    try:
        response = requests.post(
            endpoint,
            auth=auth,
            json=payload,
            headers=headers
        ).json()
        if 'errors' in response:
            print('Error attempting to query AppSync')
            print(response['errors'])
        else:
            print(response)
            return response
    except Exception as exception:
        print('Error with Query')
        print(exception)

    return None


def list_existing_sso_instances():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_user(username):
    try:
        client = boto3.client('identitystore')
        response = client.get_user_id(
            IdentityStoreId=sso_instance['IdentityStoreId'],
            AlternateIdentifier={
                'UniqueAttribute': {
                    'AttributePath': 'userName',
                    'AttributeValue': username
                },
            }
        )
        if response['UserId']:
            return response['UserId']
        else:
            return
    except ClientError as e:
        print(e.response['Error']['Message'])


def invoke_approval_sm(request, sm_arn, notification_config, team_config):
    sfn_client = boto3.client('stepfunctions')
    try:
        response = sfn_client.start_execution(
            stateMachineArn=sm_arn,
            name=request["id"],
            input=(json.dumps({**request, **notification_config, **team_config})))
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        error_message = e.response.get('Error', {}).get('Message')
        print(error_message)
        # Duplicate stream events can race; this keeps execution idempotent by request id.
        if error_code == "ExecutionAlreadyExists":
            return None
    else:
        sfn_arn = response.get('executionArn')
        return sfn_arn


sso_instance = list_existing_sso_instances()


def get_request_data(data, expire, approval_required):
    request = {
        "email": data.get("email", {}).get("S"),
        "username": data["username"]["S"],
        "duration": str(int(data["duration"]["S"]) * 60 * 60),
        "accountId": data["accountId"]["S"],
        "status": data["status"]["S"],
        "accountName": data["accountName"]["S"],
        "id": data["id"]["S"],
        "role": data["role"]["S"],
        "roleId": data["roleId"]["S"],
        "time": data["duration"]["S"],
        "startTime": data["startTime"]["S"],
        "justification": data["justification"]["S"],
        "ticketNo": data.get("ticketNo", {}).get("S"),
        "approver": data.get("approver", {}).get("S"),
        "revoker": data.get("revoker", {}).get("S"),
        "customerId": data.get("customerId", {}).get("S"),
        "customerName": data.get("customerName", {}).get("S"),
        "assignmentPrincipalId": data.get("assignmentPrincipalId", {}).get("S"),
        "assignmentPrincipalType": data.get("assignmentPrincipalType", {}).get("S"),
        "assignmentRequestId": data.get("assignmentRequestId", {}).get("S"),
        "activationError": data.get("activationError", {}).get("S"),
        "instanceARN": sso_instance['InstanceArn'],
        "approvers": [approver["S"] for approver in data.get("approvers", {}).get("L",[]) if approver["S"] != data.get("email", {}).get("S")],
        "expire": expire,
        "approvalRequired": approval_required
    }
    return request

def eligibility_error(request, reason="Invalid eligibility policy for the requested account/permission combination."):
    print("Error - Invalid Eligibility")
    updateRequest({
        "id": request["id"],
        "status": "error",
        "activationError": reason
    })
    
def get_eligibility(request, userId):
    eligible = False
    # Initially assume approval is required
    approvalRequired = True
    groupIds = [group['GroupId'] for group in list_idc_group_membership(userId)]
    entitlement = getEntitlements(userId=userId, groupIds=groupIds)
    print(entitlement)
    max_duration_error = True
    for eligibility in entitlement:
        if int(request["time"]) <= int(eligibility["duration"]):
            max_duration_error = False
        for account in eligibility["accounts"]:
            if request["accountId"] ==  account["id"]:
                for permission in eligibility["permissions"]:
                    if request["roleId"] == permission["id"]:
                        eligible = True
                        # Only need a single eligibility to not require approval to
                        # bypass approval for this request.
                        if not eligibility["approvalRequired"]:
                            approvalRequired = False

    if max_duration_error:
        print("Error - Invalid Duration")
        return eligibility_error(request, "Requested duration exceeds eligibility policy limits.") 
    if eligible:
        return {"approval": approvalRequired}
    else:
        return eligibility_error(request)          

def check_settings():
    settings = get_settings()
    item_settings = settings.get("Item", {})
    approval_required = item_settings.get("approval", True)
    ticket_required = item_settings.get("ticketNo", True)
    activation_mode = item_settings.get("activationMode", "immediate")
    if activation_mode not in ["immediate", "scheduled"]:
        activation_mode = "immediate"
    expiry = int(item_settings.get("expiry", 3)) * 60 * 60
    max_duration = item_settings.get("duration", "9")
    ses_notifications_enabled = item_settings.get("sesNotificationsEnabled", False)
    sns_notifications_enabled = item_settings.get("snsNotificationsEnabled", False)
    slack_notifications_enabled = item_settings.get("slackNotificationsEnabled", False)
    ses_source_email = item_settings.get("sesSourceEmail", "")
    ses_source_arn = item_settings.get("sesSourceArn", "")
    notification_config = {
        "ses_notifications_enabled": ses_notifications_enabled,
        "sns_notifications_enabled": sns_notifications_enabled,
        "slack_notifications_enabled": slack_notifications_enabled,
        "ses_source_email": ses_source_email,
        "ses_source_arn": ses_source_arn,
        "notification_topic_arn": notification_topic_arn,
    }
    return {
        "approval_required": approval_required, 
        "ticket_required": ticket_required,
        "activation_mode": activation_mode,
        "expiry": expiry, 
        "max_duration": max_duration,
        "notification_config": notification_config,
    }

        
def invoke_workflow(request, approval_required, notification_config, team_config, activation_mode):
    workflow = None
    if approval_required and request["status"] == "pending":
        print("sending approval")
        workflow = approval
    elif approval_required and request["status"] == "approved" and request["email"] != request["approver"]:
        if activation_mode == "scheduled":
            print("scheduling session")
            workflow = schedule
        else:
            print("granting session immediately")
            workflow = grant
    elif approval_required and request["status"] == "rejected" and request["email"] != request["approver"]:
        print("rejecting request")
        workflow = reject
    elif request["status"] == "revoked":
        print("revoking session")
        workflow = revoke
    elif request["status"] == "pending" and not approval_required:
        if activation_mode == "scheduled":
            print("scheduling session - approval not required")
            workflow = schedule
        else:
            print("granting session immediately - approval not required")
            workflow = grant
    elif request["status"] == "cancelled":
        print("cancelling request")
        workflow = reject
    elif approval_required and request["status"] in ["approved","rejected"] and request["email"] == request["approver"]:
        print("Error: Invalid Approver")
        input = {
                'id': request["id"],
                'status': 'error'
                }
        updateRequest(input)
    else:
        print("no action")
    if workflow:
        invoke_approval_sm(request, workflow, notification_config, team_config)

def get_email(username):
    cognito = boto3.client('cognito-idp', config=Config(user_agent_extra="team-idc"))
    next_page = None
    kwargs = {
        'UserPoolId': user_pool_id,
        "Filter": f"username = \"{username}\"",
        "AttributesToGet": [
            "email"
        ],
    }
    users_remain = True
    while(users_remain):
        if next_page:
            kwargs['PaginationToken'] = next_page
        response = cognito.list_users(**kwargs)
        next_page = response.get('PaginationToken', None)
        users_remain = next_page is not None

    email_id = response['Users'][0]['Attributes'][0]['Value']
    return email_id

async def getPsDuration(ps):
    client = boto3.client('sso-admin')
    response = client.describe_permission_set(
    InstanceArn=sso_instance['InstanceArn'],
    PermissionSetArn=ps
    )
    return response['PermissionSet']['SessionDuration']

def get_customer_by_id(customer_id):
    if not customer_id:
        return None
    try:
        response = customers_table.get_item(Key={'id': customer_id})
        return response.get("Item")
    except ClientError as e:
        print(e.response['Error']['Message'])
        return None


def get_customer_by_account_id(account_id):
    if not account_id:
        return None
    try:
        response = customers_table.scan(
            FilterExpression=Attr("accountIds").contains(account_id)
        )
        items = response.get("Items", [])
        if not items:
            return None
        active_items = [
            item
            for item in items
            if item.get("status") in [None, "active"] and item.get("roleStatus") in [None, "established"]
        ]
        return active_items[0] if active_items else items[0]
    except ClientError as e:
        print(e.response['Error']['Message'])
        return None


def get_customer_for_request(customer_id, account_id):
    customer = get_customer_by_id(customer_id)
    if customer and customer.get("status", "active") == "active" and customer.get("roleStatus", "established") == "established":
        return customer
    return get_customer_by_account_id(account_id)


def get_approver_group_ids(accountId, customer_id=None):
    customer = get_customer_for_request(customer_id, accountId)
    if not customer:
        return []
    return [group_id for group_id in customer.get("approverGroupIds", []) if group_id]

def get_approvers(userId):
    client = boto3.client('identitystore')
    response = client.describe_user(
        IdentityStoreId=sso_instance['IdentityStoreId'],
        UserId=userId
    )
    approver_id = "idc_" + response['UserName']
    for email in response['Emails']:
        if email:
            approver = email["Value"]
            break
    return {"approver_id": approver_id, "approver": approver}

def list_group_membership(groupId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_group_memberships')
        paginator = p.paginate(IdentityStoreId=sso_instance['IdentityStoreId'],
        GroupId=groupId,
        )
        all_groups = []
        for page in paginator:
            all_groups.extend(page["GroupMemberships"])
        return all_groups
    except ClientError as e:
        print(e.response['Error']['Message'])
        
async def get_approvers_details(accountId, customer_id=None):
    approver_groups = get_approver_group_ids(accountId, customer_id)
    approvers = []
    approver_ids = []
    if approver_groups:
        for group in approver_groups:
            approvers_data = [get_approvers(result["MemberId"]["UserId"])
                for result in list_group_membership(group)]
            for data in approvers_data:
                if data["approver"] not in approvers:
                    approvers.append(data["approver"])
                    approver_ids.append(data["approver_id"].lower())
    return {"approvers":approvers, "approver_ids":approver_ids}

async def updateRequestDetails(request_id, username, accountId, roleId, customer_id=None):
    email = get_email(username)
    customer = get_customer_for_request(customer_id, accountId)
    approver_details = await get_approvers_details(accountId, customer.get("id") if customer else customer_id)
    approver_ids = approver_details["approver_ids"]
    approvers = approver_details["approvers"]
    username_without_prefix = username[4:] if username.startswith("idc_") else username
    requester_user_id = get_user(username_without_prefix)

    input = {
        'id': request_id,
        'email': email,
        'approvers': approvers,
        'approver_ids': approver_ids,
    }

    if customer:
        input["customerId"] = customer.get("id")
        input["customerName"] = customer.get("name")
    if requester_user_id:
        input["assignmentPrincipalId"] = requester_user_id
        input["assignmentPrincipalType"] = "USER"

    # Only fetch SSO permission set duration for SSO role IDs
    if not roleId.startswith("mt-"):
        session_duration = await getPsDuration(roleId)
        input['session_duration'] = session_duration
    else:
        input['session_duration'] = 'PT1H'
    
    updateRequest(input)

def updateApproverDetails(request_id,username):
    approver = get_email(username)
    input = {
            'id': request_id,
            'approver': approver
            }
    updateRequest(input)

def updateRevokerDetails(request_id,username):
    revoker = get_email(username)
    input = {
            'id': request_id,
            'revoker': revoker
            }
    updateRequest(input)

def request_is_updated(status,data,username,request_id):
    updated = False
    if status in ["error", "ended"]:
        return updated
    elif status == "pending" and "email" not in data.keys():
        asyncio.run(
            updateRequestDetails(
                request_id,
                username,
                data["accountId"]["S"],
                data["roleId"]["S"],
                data.get("customerId", {}).get("S"),
            )
        )
        print("updating request details")
    elif status in ["approved","rejected"] and "approver" not in data.keys():
        updateApproverDetails(request_id,data["approverId"]["S"])
    elif status == "revoked" and "revoker" not in data.keys():
        updateRevokerDetails(request_id,data["revokerId"]["S"])
    else:
        updated = True
    return updated

def handler(event, context):
    data = event["Records"].pop()["dynamodb"]["NewImage"]
    print("Checking if request is updated")
    status = data["status"]["S"]
    username = data["username"]["S"]
    request_id = data["id"]["S"]
    if request_is_updated(status,data,username,request_id):
        settings = check_settings()
        approval_required = settings["approval_required"]
        ticket_required = settings["ticket_required"]
        activation_mode = settings["activation_mode"]
        notification_config = settings["notification_config"]
        expiry_time = settings["expiry"]
        request = get_request_data(data, expiry_time, approval_required)
        if int(request["time"]) > int(settings["max_duration"]):
            print("Error: Invalid Duration")
            return updateRequest({
                "id": request["id"],
                "status": "error",
                "activationError": f"Requested duration exceeds maximum allowed duration ({settings['max_duration']} hours)."
            })
        if ticket_required and not request.get("ticketNo"):
            print("Error: Missing ticket number")
            return updateRequest({
                "id": request["id"],
                "status": "error",
                "activationError": "Ticket number is required by policy."
            })
        print("Received event: %s" % json.dumps(request))
        # Enforce SSO-only mode.
        role_id = data.get("roleId", {}).get("S", "")
        if role_id.startswith("mt-"):
            print("Error: Multi-tenant role IDs are disabled in SSO-only mode")
            updateRequest({
                "id": request["id"],
                "status": "error",
                "activationError": "Multi-tenant role IDs are disabled. Submit a request with an IAM Identity Center permission set ARN."
            })
            return
        else:
            request_username = data["username"]["S"]
            normalized_username = request_username[4:] if request_username.startswith("idc_") else request_username
            userId = get_user(normalized_username)
            if not userId:
                print(f"Error: Unable to resolve IAM Identity Center userId for username {normalized_username}")
                updateRequest({
                    "id": request["id"],
                    "status": "error",
                    "activationError": f"Unable to resolve IAM Identity Center user for {normalized_username}"
                })
                return
            request["userId"] = userId
            request["assignmentPrincipalId"] = userId
            request["assignmentPrincipalType"] = "USER"
            customer = get_customer_for_request(request.get("customerId"), request["accountId"])
            if not customer:
                print(f"Error: No customer mapping found for account {request['accountId']}")
                updateRequest({
                    "id": request["id"],
                    "status": "error",
                    "activationError": f"No active customer mapping found for account {request['accountId']}"
                })
                return
            customer_account_ids = [str(account_id) for account_id in customer.get("accountIds", [])]
            if str(request["accountId"]) not in customer_account_ids:
                print(f"Error: Account {request['accountId']} not mapped to customer {customer.get('id')}")
                updateRequest({
                    "id": request["id"],
                    "status": "error",
                    "activationError": f"Account {request['accountId']} is not mapped to customer {customer.get('name')}"
                })
                return
            request["customerId"] = customer.get("id")
            request["customerName"] = customer.get("name")
            eligible = get_eligibility(request, userId)
            if eligible:
                if approval_required:
                    approval_required = eligible["approval"]
                    request["approvalRequired"] = eligible["approval"]
                invoke_workflow(
                    request,
                    approval_required,
                    notification_config,
                    team_config,
                    activation_mode,
                )
    else:
        print("Request not updated")
        
