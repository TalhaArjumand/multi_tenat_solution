# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http://aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
import os
from botocore.exceptions import ClientError
from operator import itemgetter

# Initialize clients
org_client = boto3.client('organizations')
dynamodb = boto3.resource('dynamodb')

ACCOUNT_ID = os.environ['ACCOUNT_ID']
API_TEAM_CUSTOMERSTABLE_NAME = os.environ.get('API_TEAM_CUSTOMERSTABLE_NAME', '')


def get_mgmt_account_id():
    """Get the AWS Organizations management account ID"""
    try:
        response = org_client.describe_organization()
        return response['Organization']['MasterAccountId']
    except ClientError as e:
        print(f"Error getting management account: {e.response['Error']['Message']}")
        return None


def get_customers():
    """Retrieve all customers from DynamoDB"""
    customers = {}
    if not API_TEAM_CUSTOMERSTABLE_NAME:
        return customers
    
    try:
        table = dynamodb.Table(API_TEAM_CUSTOMERSTABLE_NAME)
        response = table.scan()
        
        for customer in response.get('Items', []):
            customer_id = customer.get('id')
            customer_name = customer.get('name', 'Unknown')
            account_ids = customer.get('accountIds', [])
            
            # Create a mapping of accountId -> customer info
            for account_id in account_ids:
                customers[account_id] = {
                    'customerId': customer_id,
                    'customerName': customer_name
                }
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            for customer in response.get('Items', []):
                customer_id = customer.get('id')
                customer_name = customer.get('name', 'Unknown')
                account_ids = customer.get('accountIds', [])
                
                for account_id in account_ids:
                    customers[account_id] = {
                        'customerId': customer_id,
                        'customerName': customer_name
                    }
    
    except Exception as e:
        print(f"Error retrieving customers: {str(e)}")
    
    return customers


def handler(event, context):
    """
    Returns list of AWS accounts with customer information
    """
    accounts = []
    mgmt_account_id = get_mgmt_account_id()
    deployed_in_mgmt = True if ACCOUNT_ID == mgmt_account_id else False
    
    # Get customer mappings
    customer_mapping = get_customers()
    
    try:
        # Get all accounts from AWS Organizations
        paginator = org_client.get_paginator('list_accounts')
        page_iterator = paginator.paginate()

        for page in page_iterator:
            for acct in page['Accounts']:
                account_id = acct['Id']
                
                # Skip management account if not deployed there
                if not deployed_in_mgmt and account_id == mgmt_account_id:
                    continue
                
                # Build account info with customer data
                account_info = {
                    "name": acct['Name'],
                    'id': account_id
                }
                
                # Add customer information if available
                if account_id in customer_mapping:
                    account_info['customerId'] = customer_mapping[account_id]['customerId']
                    account_info['customerName'] = customer_mapping[account_id]['customerName']
                else:
                    account_info['customerId'] = None
                    account_info['customerName'] = None
                
                accounts.append(account_info)
        
        return sorted(accounts, key=itemgetter('name'))
        
    except ClientError as e:
        print(f"Error listing accounts: {e.response['Error']['Message']}")
        return []
