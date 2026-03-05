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
    
policy_table_name = os.getenv("POLICY_TABLE_NAME")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
approver_table_name = os.getenv("APPROVER_TABLE_NAME")
requests_table_name = os.getenv("REQUESTS_TABLE_NAME")
customers_table_name = os.getenv("CUSTOMERS_TABLE_NAME")
user_pool_id = os.getenv("AUTH_TEAM06DBB7FC_USERPOOLID")
dynamodb = boto3.resource('dynamodb')
approver_table = dynamodb.Table(approver_table_name)
policy_table = dynamodb.Table(policy_table_name)
settings_table = dynamodb.Table(settings_table_name)

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
        print(e.response['Error']['Message'])
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
        "customerId": data.get("customerId", {}).get("S"),
        "customerName": data.get("customerName", {}).get("S"),
        "approver": data.get("approver", {}).get("S"),
        "revoker": data.get("revoker", {}).get("S"),
        "instanceARN": sso_instance['InstanceArn'],
        "approvers": [approver["S"] for approver in data.get("approvers", {}).get("L",[]) if approver["S"] != data.get("email", {}).get("S")],
        "expire": expire,
        "approvalRequired": approval_required
    }
    return request

def eligibility_error(request, reason="INVALID_ELIGIBILITY"):
    print(f"Error - Invalid Eligibility ({reason})")
    input = {
            'id': request["id"],
            'status': 'error',
            'comment': reason,
            }
    updateRequest(input)
    return {"error": reason}
    
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
        return eligibility_error(request) 
    if eligible:
        return {"approval": approvalRequired}
    else:
        return eligibility_error(request)          

def check_settings():
    settings = get_settings()
    item_settings = settings.get("Item", {})
    approval_required = item_settings.get("approval", True)
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
        "expiry": expiry, 
        "max_duration": max_duration,
        "notification_config": notification_config,
    }

        
def invoke_workflow(request, approval_required, notification_config, team_config):
    workflow = None
    if approval_required and request["status"] == "pending":
        print("sending approval")
        workflow = approval
    elif approval_required and request["status"] == "approved" and request["email"] != request["approver"]:
        print("scheduling session")
        workflow = schedule
    elif approval_required and request["status"] == "rejected" and request["email"] != request["approver"]:
        print("rejecting request")
        workflow = reject
    elif request["status"] == "revoked":
        print("revoking session")
        workflow = revoke
    elif request["status"] == "pending" and not approval_required:
        print("scheduling session - approval not required")
        workflow = schedule
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

def get_ou(id):
    client = boto3.client('organizations')
    try:
        response = client.list_parents(
            ChildId=id
        )
        return response["Parents"][0]
    except ClientError as e:
        print(e.response['Error']['Message'])

async def getPsDuration(ps):
    client = boto3.client('sso-admin')
    response = client.describe_permission_set(
    InstanceArn=sso_instance['InstanceArn'],
    PermissionSetArn=ps
    )
    return response['PermissionSet']['SessionDuration']

def list_approvers(id):
    try:
        response = approver_table.get_item(
            Key={
                'id': id
            }
        )
        if "Item" in response.keys():
            return (response['Item']['groupIds'])
        else:
            return []
    except ClientError as e:
        print(e.response['Error']['Message'])

def get_customer(customer_id):
    if not customer_id:
        return None
    customers_table = dynamodb.Table(customers_table_name)
    response = customers_table.get_item(
        Key={
            'id': customer_id
        }
    )
    return response.get("Item")
        
def get_approver_group_ids(accountId):
    approvers = []
    approvers.extend(list_approvers(accountId))
    try:
        ou = get_ou(accountId)
        if ou:
            approvers.extend(list_approvers(ou["Id"]))
    except Exception as e:
        # External customer accounts are not in our AWS Organization
        # so OU lookup will fail — this is expected for multi-tenant
        print(f"Could not get OU for account {accountId} (may be external): {e}")
    return approvers

def get_approvers(userId):
    client = boto3.client('identitystore')
    response = client.describe_user(
        IdentityStoreId=sso_instance['IdentityStoreId'],
        UserId=userId
    )
    approver_id = "idc_" + response['UserName']
    approver = None
    for email in response.get('Emails', []):
        if email and email.get("Value"):
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
        return []

def get_approvers_details_from_group_ids(group_ids):
    approvers = []
    approver_ids = []
    member_user_ids = set()
    if group_ids:
        for group in group_ids:
            for result in list_group_membership(group):
                user_id = result.get("MemberId", {}).get("UserId")
                if not user_id or user_id in member_user_ids:
                    continue
                member_user_ids.add(user_id)
                data = get_approvers(user_id)
                approver_email = data.get("approver")
                if approver_email and approver_email not in approvers:
                    approvers.append(approver_email)
                approver_id = data.get("approver_id")
                if approver_id:
                    approver_id = approver_id.lower()
                    if approver_id not in approver_ids:
                        approver_ids.append(approver_id)
    return {"approvers": approvers, "approver_ids": approver_ids, "member_count": len(member_user_ids)}
        
async def get_approvers_details(accountId):
    approver_groups = get_approver_group_ids(accountId)
    approver_details = get_approvers_details_from_group_ids(approver_groups)
    return {
        "approvers": approver_details["approvers"],
        "approver_ids": approver_details["approver_ids"],
    }

async def updateRequestDetails(request_id, username, accountId, roleId, customerId=None):
    email = get_email(username)
    if roleId.startswith("mt-"):
        customer = get_customer(customerId)
        approver_group_ids = customer.get("approverGroupIds", []) if customer else []
        approver_details = get_approvers_details_from_group_ids(approver_group_ids)
    else:
        approver_details = await get_approvers_details(accountId)
    approver_ids = approver_details["approver_ids"]
    approvers = approver_details["approvers"]

    if roleId.startswith("mt-"):
        requester_approver_id = (username or "").lower()
        if requester_approver_id and not requester_approver_id.startswith("idc_"):
            requester_approver_id = f"idc_{requester_approver_id}"
        approver_ids = [
            approver_id for approver_id in approver_ids
            if approver_id != requester_approver_id
        ]
        requester_email = (email or "").lower()
        approvers = [
            approver for approver in approvers
            if approver and approver.lower() != requester_email
        ]

    input = {
        'id': request_id,
        'email': email,
        'approvers': approvers,
        'approver_ids': approver_ids,
    }

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
        asyncio.run(updateRequestDetails(
            request_id,
            username,
            data["accountId"]["S"],
            data["roleId"]["S"],
            data.get("customerId", {}).get("S"),
        ))
        print("updating request details")
    elif status in ["approved","rejected"] and "approver" not in data.keys():
        updateApproverDetails(request_id,data["approverId"]["S"])
    elif status == "revoked" and "revoker" not in data.keys():
        updateRevokerDetails(request_id,data["revokerId"]["S"])
    else:
        updated = True
    return updated

def get_allowed_roles_for_permission_set(permission_set):
    """Map customer's permission set to allowed roles."""
    if permission_set == 'admin':
        return ['ReadOnlyAccess', 'S3FullAccess', 'EC2FullAccess', 'PowerUserAccess',
                'AdministratorAccess', 'DatabaseAdmin', 'NetworkAdmin', 'SecurityAudit']
    elif permission_set == 'read-only':
        return ['ReadOnlyAccess', 'SecurityAudit']
    else:
        return ['ReadOnlyAccess', 'S3FullAccess', 'EC2FullAccess',
                'DatabaseAdmin', 'NetworkAdmin', 'SecurityAudit']


def check_multi_tenant_eligibility(request):
    """
    Check if request is for a multi-tenant customer account.
    If so, validate eligibility based on Customers table.
    """
    account_id = str(request.get("accountId", ""))
    role_id = request.get("roleId", "")
    customer_id = request.get("customerId")

    if not role_id.startswith("mt-"):
        return None

    if not customer_id:
        print("Missing customerId for multi-tenant request")
        return {"error": "MISSING_CUSTOMER_ID"}

    try:
        customer = get_customer(customer_id)
        if not customer:
            print(f"Customer not found for customerId {customer_id}")
            return {"error": "CUSTOMER_NOT_FOUND"}
        if customer.get("roleStatus") != "established":
            print(f"Customer {customer_id} roleStatus is not established")
            return {"error": "CUSTOMER_ROLE_NOT_ESTABLISHED"}

        account_ids = [str(customer_account_id) for customer_account_id in customer.get("accountIds", [])]
        if account_id not in account_ids:
            print(f"Account {account_id} is not mapped to customer {customer_id}")
            return {"error": "CUSTOMER_ACCOUNT_MISMATCH"}

        role_name = role_id.replace("mt-", "")
        allowed_roles = get_allowed_roles_for_permission_set(customer.get('permissionSet', 'read-only'))

        if role_name not in allowed_roles:
            print(f"Role {role_name} not allowed for customer {customer['name']} (permissionSet: {customer['permissionSet']})")
            return {"error": "INVALID_MT_ROLE_FOR_CUSTOMER"}

        approver_group_ids = customer.get("approverGroupIds") or []
        if len(approver_group_ids) < 1:
            print(f"No approver groups configured for customer {customer_id}")
            return {"error": "MISSING_CUSTOMER_APPROVERS"}

        approver_details = get_approvers_details_from_group_ids(approver_group_ids)
        requester_email = (request.get("email") or "").lower()
        requester_approver_id = (request.get("username") or "").lower()
        if requester_approver_id and not requester_approver_id.startswith("idc_"):
            requester_approver_id = f"idc_{requester_approver_id}"
        requester_is_approver = requester_approver_id in [
            (approver_id or "").lower() for approver_id in (approver_details.get("approver_ids") or [])
        ]
        approver_group_members_required = 2 if requester_is_approver else 1
        if approver_details["member_count"] < approver_group_members_required:
            print(
                f"Insufficient approver members for customer {customer_id}. "
                f"members={approver_details['member_count']} required={approver_group_members_required}"
            )
            return {"error": "INSUFFICIENT_APPROVER_MEMBERS"}

        approver_details["approvers"] = [
            approver for approver in approver_details["approvers"]
            if approver.lower() != requester_email
        ]
        requester_approver_id = (request.get("username") or "").lower()
        if requester_approver_id and not requester_approver_id.startswith("idc_"):
            requester_approver_id = f"idc_{requester_approver_id}"
        approver_details["approver_ids"] = [
            approver_id for approver_id in approver_details["approver_ids"]
            if approver_id != requester_approver_id
        ]

        # Multi-tenant requests MUST go through approval workflow
        return {"approval": True, "approverDetails": approver_details}

    except Exception as e:
        print(f"Error checking multi-tenant eligibility: {e}")
        return {"error": "MT_ELIGIBILITY_CHECK_FAILED"}


def handler(event, context):
    data = event["Records"].pop()["dynamodb"]["NewImage"]
    print("Checking if request is updated")
    status = data["status"]["S"]
    username = data["username"]["S"]
    request_id = data["id"]["S"]
    if request_is_updated(status,data,username,request_id):
        settings = check_settings()
        approval_required = settings["approval_required"]
        notification_config = settings["notification_config"]
        expiry_time = settings["expiry"]
        request = get_request_data(data, expiry_time, approval_required)
        if int(request["time"]) > int(settings["max_duration"]):
            print("Error: Invalid Duration")
            input = {
                    'id': request["id"],
                    'status': 'error'
                    }
            return updateRequest(input)
        print("Received event: %s" % json.dumps(request))
        # Check if this is a multi-tenant request
        role_id = data.get("roleId", {}).get("S", "")
        if role_id.startswith("mt-"):
            mt_eligible = check_multi_tenant_eligibility(request)
            if not mt_eligible or mt_eligible.get("error"):
                error_code = mt_eligible.get("error", "INVALID_MT_ELIGIBILITY") if mt_eligible else "INVALID_MT_ELIGIBILITY"
                return eligibility_error(request, error_code)
            if mt_eligible.get("approval"):
                # Always require approval for multi-tenant to match SSO behavior
                mt_approval = True
                request["approvalRequired"] = mt_approval
                request["isMultiTenant"] = True
                request["approvers"] = mt_eligible["approverDetails"]["approvers"]
                request["approver_ids"] = mt_eligible["approverDetails"]["approver_ids"]
                invoke_workflow(request, mt_approval, notification_config, team_config)
        else:
            userId = get_user((data["username"]["S"])[4:])
            request["userId"] = userId
            eligible = get_eligibility(request, userId)
            if eligible:
                if approval_required:
                    approval_required = eligible["approval"]
                    request["approvalRequired"] = eligible["approval"]
                invoke_workflow(request, approval_required, notification_config, team_config)
    else:
        print("Request not updated")
        
