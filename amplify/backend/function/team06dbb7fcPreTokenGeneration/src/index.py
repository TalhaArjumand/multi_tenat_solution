# © 2024 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import os
from botocore.exceptions import ClientError
import boto3
import json
from boto3.dynamodb.conditions import Attr

team_admin_group = os.getenv("TEAM_ADMIN_GROUP")
team_auditor_group = os.getenv("TEAM_AUDITOR_GROUP")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
customers_table_name = os.getenv("CUSTOMERS_TABLE_NAME")
customer_app_client_id = os.getenv("CUSTOMER_APP_CLIENT_ID")
dynamodb = boto3.resource('dynamodb')
settings_table = dynamodb.Table(settings_table_name)
customers_table = dynamodb.Table(customers_table_name) if customers_table_name else None
sso_instance = None

def get_settings():
    response = settings_table.get_item(
        Key={
            'id': 'settings'
        }
    )
    return response

def get_team_groups():
    try:
        settings = get_settings()
        item_settings = settings.get("Item", {})
        team_admin_group = item_settings.get("teamAdminGroup", os.getenv("TEAM_ADMIN_GROUP"))
        team_auditor_group = item_settings.get("teamAuditorGroup", os.getenv("TEAM_AUDITOR_GROUP"))
    except Exception as e:
        print(f"Error retrieving TEAM settings from database: {e}")
    return team_admin_group, team_auditor_group


def get_identity_store_id():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]['IdentityStoreId']
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_sso_instance():
    global sso_instance
    if sso_instance is None:
        sso_instance = get_identity_store_id()
    return sso_instance


def get_user(username):
    try:
        identity_store_id = get_sso_instance()
        if not identity_store_id:
            return None
        client = boto3.client('identitystore')
        response = client.get_user_id(
            IdentityStoreId=identity_store_id,
            AlternateIdentifier={
                'UniqueAttribute': {
                    'AttributePath': 'userName',
                    'AttributeValue': username
                },
            }
        )
        return response['UserId']
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_group(group):
    try:
        identity_store_id = get_sso_instance()
        if not identity_store_id:
            return None
        client = boto3.client('identitystore')
        response = client.get_group_id(
            IdentityStoreId=identity_store_id,
            AlternateIdentifier={
                'UniqueAttribute': {
                    'AttributePath': 'DisplayName',
                    'AttributeValue': group
                }
            }
        )
        return response['GroupId']
    except ClientError as e:
        print(e.response['Error']['Message'])

# Paginate

def list_idc_group_membership(userId):
    try:
        identity_store_id = get_sso_instance()
        if not identity_store_id:
            return []
        client = boto3.client('identitystore')
        p = client.get_paginator('list_group_memberships_for_member')
        paginator = p.paginate(IdentityStoreId=identity_store_id,
            MemberId={
                'UserId': userId
            })
        all_groups = []
        for page in paginator:
            all_groups.extend(page["GroupMemberships"])
        return all_groups
    except ClientError as e:
        print(e.response['Error']['Message'])


def structured_log(event_name, **kwargs):
    print(json.dumps({"event": event_name, **kwargs}))


def build_customer_response(customer_id=None, auth_error=None):
    claims = {
        "custom:userType": "customer"
    }

    if customer_id:
        claims["custom:customerId"] = customer_id

    if auth_error:
        claims["custom:authError"] = auth_error

    return {
        "claimsOverrideDetails": {
            "claimsToAddOrOverride": claims,
            "groupOverrideDetails": {
                "groupsToOverride": []
            }
        }
    }


def normalize_email(value):
    return (value or "").strip().lower()


def get_established_customers_by_admin_email(email):
    if not customers_table:
        structured_log("DU1_CUSTOMER_LOOKUP_UNAVAILABLE", reason="CUSTOMERS_TABLE_NAME_MISSING")
        return None, "CUSTOMERS_TABLE_NOT_CONFIGURED"

    try:
        items = []
        scan_kwargs = {
            "FilterExpression": Attr('roleStatus').eq('established')
        }
        while True:
            response = customers_table.scan(**scan_kwargs)
            items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key
    except ClientError as e:
        structured_log(
            "DU1_CUSTOMER_LOOKUP_UNAVAILABLE",
            reason="CUSTOMERS_SCAN_FAILED",
            message=e.response['Error']['Message']
        )
        return None, "CUSTOMERS_LOOKUP_FAILED"

    normalized_email = normalize_email(email)
    matches = [
        item for item in items
        if normalize_email(item.get("adminEmail")) == normalized_email
    ]
    return matches, None


def build_workforce_response(event, team_admin_group, team_auditor_group):
    user_name = event.get("userName", "")
    if "_" not in user_name:
        structured_log(
            "DU1_WORKFORCE_TOKEN_FAILED",
            reason="UNEXPECTED_USERNAME_FORMAT",
            userName=user_name
        )
        raise ValueError("Unexpected workforce username format")

    user = user_name.split("_", 1)[1]
    userId = get_user(user)
    admin = get_group(team_admin_group)
    auditor = get_group(team_auditor_group)
    groups = []
    groupIds = str()

    groupData = list_idc_group_membership(userId)

    for group in groupData:
        groupIds += group["GroupId"] + ","
        if group["GroupId"] == admin:
            groups.append("Admin")
        elif group["GroupId"] == auditor:
            groups.append("Auditors")

    structured_log(
        "DU1_WORKFORCE_TOKEN_ISSUED",
        userName=event.get("userName"),
        clientId=((event.get("callerContext") or {}).get("clientId"))
    )

    return {
        "claimsOverrideDetails": {
            "claimsToAddOrOverride": {
                "userId": userId,
                "groupIds": groupIds,
                "groups": ",".join(groups)
            },
            "groupOverrideDetails": {
                "groupsToOverride": groups,
            },
        }
    }


def handler(event, context):
    team_admin_group, team_auditor_group = get_team_groups()

    client_id = ((event.get("callerContext") or {}).get("clientId"))

    if customer_app_client_id and client_id == customer_app_client_id:
        email = normalize_email(((event.get("request") or {}).get("userAttributes") or {}).get("email"))

        if not email:
            structured_log(
                "DU1_CUSTOMER_LOOKUP_FAILED",
                path="customer",
                clientId=client_id,
                result="missing_email"
            )
            event["response"] = build_customer_response(auth_error="MISSING_EMAIL_CLAIM")
            return event

        matches, lookup_error = get_established_customers_by_admin_email(email)

        if lookup_error:
            structured_log(
                "DU1_CUSTOMER_LOOKUP_FAILED",
                path="customer",
                clientId=client_id,
                email=email,
                result="lookup_failed",
                authError=lookup_error
            )
            event["response"] = build_customer_response(auth_error=lookup_error)
            return event

        if len(matches) == 1:
            customer_id = matches[0]["id"]
            structured_log(
                "DU1_CUSTOMER_TOKEN_ISSUED",
                path="customer",
                clientId=client_id,
                email=email,
                result="resolved",
                customerId=customer_id
            )
            event["response"] = build_customer_response(customer_id=customer_id)
            return event

        auth_error = "CUSTOMER_NOT_ESTABLISHED_OR_NOT_FOUND" if len(matches) == 0 else "CUSTOMER_AMBIGUOUS"
        structured_log(
            "DU1_CUSTOMER_LOOKUP_FAILED",
            path="customer",
            clientId=client_id,
            email=email,
            result="not_found" if len(matches) == 0 else "ambiguous",
            matchCount=len(matches),
            authError=auth_error
        )
        event["response"] = build_customer_response(auth_error=auth_error)
        return event

    event["response"] = build_workforce_response(event, team_admin_group, team_auditor_group)

    return event
