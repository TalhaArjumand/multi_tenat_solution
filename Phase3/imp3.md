 PHASE 3: Complete Multi-Tenant TEAM — Detailed Step-by-Step Implementation Guide
Current State Assessment
You have successfully completed Phase 1 & 2 (Customer Onboarding):

✅ Schema with 13 new fields on Customers type
✅ 6 Lambda functions (CloudFormation generation, invitation, approval, verification)
✅ Customer approval page (CustomerApprovalPage.js)
✅ Customer dropdown in Request.js that filters accounts by customer
✅ customerId / customerName fields on requests and sessions types
What's NOT done yet (the critical gap): Your system still uses IAM Identity Center CreateAccountAssignment to grant access. This only works for accounts inside your AWS Organization. For true multi-tenancy with external customer accounts (like Facebook), you need to replace this with sts:AssumeRole using the cross-account IAM role the customer deployed via your CloudFormation template.

STEP 1: Understand the Current Grant Flow (What You're Replacing)
Your current flow works like this:

Code
Request Created → teamRouter (DDB Stream) → invoke_workflow() 
→ Schedule Step Function → Grant Step Function → sso-admin:CreateAccountAssignment 
→ teamStatus Lambda → teamNotifications Lambda
The Grant Step Function calls sso-admin:CreateAccountAssignment which assigns a permission set to the user in IAM Identity Center. This is the single-tenant pattern.

The key file that updates status is:

umair228 / cloudiqs-msp / amplify / backend / function / teamStatus / src / index.js


The Grant Step Function currently does CreateAccountAssignment inside the step function definition (it's an AWS SDK integration, not a Lambda). You need to replace this with a Lambda task that does sts:AssumeRole for multi-tenant customers.

STEP 2: Create the teamMultiTenantGrant Lambda Function
This is the most critical new Lambda. It replaces the SSO CreateAccountAssignment for external customer accounts.

amplify/backend/function/teamMultiTenantGrant/src/index.py
v2
# Multi-Tenant Grant Lambda
# Purpose: When a request is approved for an external customer account,
# this Lambda assumes the cross-account role and stores temp credentials.
# For internal accounts, it falls back to the existing SSO flow.

import os
Deploy this Lambda:

bash
cd amplify/backend/function
amplify function add teamMultiTenantGrant
# Runtime: Python 3.9+
# Copy the code above into src/index.py
Set Environment Variables:

Variable	Value
CUSTOMERS_TABLE	Your Customers DynamoDB table name (e.g., Customers-aulamfydfvg5fmjl4uboxne7du-main)
REQUESTS_TABLE_NAME	Your requests DynamoDB table name
IAM Permissions needed:

teamMultiTenantGrant-policy.json
v2
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
STEP 3: Modify the Grant Step Function to Support Dual-Path (SSO vs AssumeRole)
Your Grant Step Function currently does a direct SDK integration to call CreateAccountAssignment. You need to modify it to first check if the request is for a multi-tenant customer, then branch.

Here's the new step function definition:

grant-step-function-definition.json
v2
{
  "Comment": "TEAM Grant Workflow - Dual Path (SSO + Multi-Tenant)",
  "StartAt": "CheckMultiTenant",
  "States": {
    "CheckMultiTenant": {
      "Type": "Task",
How to update: Go to AWS Console → Step Functions → find your Grant state machine → Edit → paste the updated definition. Replace REGION and ACCOUNT with your actual values.

STEP 4: Update the CloudFormation Template Generator for Multiple Roles
Currently, your teamGenerateCloudFormation creates a single role with one permission set. For the Facebook-example scenario where your DevOps guy needs different roles (S3FullAccess, ReadOnly, FullAdmin), you need to enhance the CloudFormation template to create multiple IAM roles — one per access level:

amplify/backend/function/teamGenerateCloudFormation/src/index.js
v2
import yaml from 'js-yaml';

const MSP_ACCOUNT_ID = process.env.MSP_ACCOUNT_ID || '722560225075';

/**
 * Role definitions that will be created in the customer's account.
STEP 5: Update the teamMultiTenantGrant to Use the Correct Role Name
Now that the customer's account has multiple roles (e.g., CloudIQS-MSP-ReadOnlyRole, CloudIQS-MSP-S3AdminRole, etc.), update the assume_customer_role function:

amplify/backend/function/teamMultiTenantGrant/src/role_mapping.py
v2
# Role name mapping - must match what's in the CloudFormation template
ROLE_NAME_MAP = {
    'ReadOnlyAccess': 'CloudIQS-MSP-ReadOnlyRole',
    'S3FullAccess': 'CloudIQS-MSP-S3AdminRole',
    'EC2FullAccess': 'CloudIQS-MSP-EC2AdminRole',
    'PowerUserAccess': 'CloudIQS-MSP-PowerUserRole',
Then in the assume_customer_role function in teamMultiTenantGrant, replace:

Python
actual_role_arn = f"arn:aws:iam::{account_id}:role/CloudIQS-MSP-AccessRole"
with:

Python
from role_mapping import get_role_arn
actual_role_arn = get_role_arn(account_id, role_name)
STEP 6: Update the Request Form (Request.js) — Role Dropdown for Multi-Tenant
Your current Request.js fetches permission sets from IAM Identity Center (SSO). For multi-tenant customers, the roles are not SSO permission sets — they're the IAM roles you defined. You need to show different role options when a multi-tenant customer is selected.

Update the role selection in Request.js:

src/components/Requests/Request.js
v2
// Add this constant at the top of the file, after imports:

const MULTI_TENANT_ROLES = [
  { name: 'ReadOnlyAccess', id: 'mt-ReadOnlyAccess', description: 'Read-only access to all resources' },
  { name: 'S3FullAccess', id: 'mt-S3FullAccess', description: 'Full S3 access' },
  { name: 'EC2FullAccess', id: 'mt-EC2FullAccess', description: 'Full EC2 access' },
STEP 7: Update the VTL Resolver for Multi-Tenant Role IDs
Your current VTL resolver at Mutation.createRequests.init.1.req.vtl validates roleId with this regex:

velocity
     !$util.matches("^arn:aws:sso:::permissionSet\/ssoins-[a-zA-Z0-9-.]{16}\/ps-[a-zA-Z0-9-.]{16}$", $ctx.args.input.roleId) ||
This will reject multi-tenant role IDs like mt-ReadOnlyAccess. Update it:

velocity
## [Start] Initialization default values. **
$util.qr($ctx.stash.put("defaultValues", $util.defaultIfNull($ctx.stash.defaultValues, {})))
#set( $createdAt = $util.time.nowISO8601() )
$util.qr($ctx.stash.defaultValues.put("id", $util.autoId()))
$util.qr($ctx.stash.defaultValues.put("createdAt", $createdAt))
$util.qr($ctx.stash.defaultValues.put("updatedAt", $createdAt))
$util.qr($ctx.stash.defaultValues.put("status", "pending"))

## Validate roleId - allow both SSO permission set ARNs AND multi-tenant role IDs
#set( $isSSORoleId = $util.matches("^arn:aws:sso:::permissionSet\/ssoins-[a-zA-Z0-9-.]{16}\/ps-[a-zA-Z0-9-.]{16}$", $ctx.args.input.roleId) )
#set( $isMultiTenantRoleId = $util.matches("^mt-[A-Za-z0-9]+$", $ctx.args.input.roleId) )

#if (!$util.matches("^\d{12}$", $ctx.args.input.accountId) || 
     (!$isSSORoleId && !$isMultiTenantRoleId) ||
     !$util.matches("^[0-9]+", $ctx.args.input.duration) ||
     $Integer.parseInt($ctx.args.input.duration) > 8000 ||
     $Integer.parseInt($ctx.args.input.duration) < 1 ||
     !$util.matches("[\w+=,.@-]+", $ctx.args.input.role) ||
     $ctx.args.input.role.length() > 32 ||
     $ctx.args.input.accountName.length() > 50
      )
    	$util.error('Invalid input')
#end

#if (($ctx.args.input.ticketNo != '' && !$util.matches("[A-Za-z0-9]", $ctx.args.input.ticketNo.substring(0,1))) || 
     !$util.matches("[\p{IsAlphabetic}\p{Digit}]", $ctx.args.input.justification.substring(0,1)))
    	$util.error('Invalid input')
#end

$util.qr($ctx.args.input.put("username", $ctx.identity.username))
$util.toJson({
  "version": "2018-05-29",
  "payload": {}
})
## [End] Initialization default values. **
STEP 8: Update teamRouter to Handle Multi-Tenant Eligibility
Your teamRouter Lambda currently checks eligibility by looking up SSO permission sets and Organization OUs. For multi-tenant customers, the eligibility check is different — it should check the Customers table.

Add this to amplify/backend/function/teamRouter/src/index.py:

amplify/backend/function/teamRouter/src/index.py
v2
# Add at the top with other env vars:
customers_table_name = os.getenv("CUSTOMERS_TABLE_NAME")

# Add this new function:
def check_multi_tenant_eligibility(request):
    """
Important: Add the CUSTOMERS_TABLE_NAME environment variable to the teamRouter Lambda in the Amplify configuration.

STEP 9: Add Console & CLI Access Buttons to Active Requests View
When a multi-tenant request is approved and active, the user needs "Access Console" and "CLI Credentials" buttons — just like in the reference broker repo.

Create a new component:

src/components/Requests/ActiveAccessActions.js
v2
import React, { useState } from "react";
import Button from "@awsui/components-react/button";
import Modal from "@awsui/components-react/modal";
import SpaceBetween from "@awsui/components-react/space-between";
import Box from "@awsui/components-react/box";
import CopyToClipboard from "@awsui/components-react/copy-to-clipboard";
STEP 10: Create the teamGetMultiTenantCredentials Lambda
This Lambda is called when the user clicks "Access Console" or "CLI Credentials" — it does a fresh AssumeRole call:

amplify/backend/function/teamGetMultiTenantCredentials/src/index.py
v2
import os
import json
import boto3
import urllib.parse
import urllib.request
from botocore.exceptions import ClientError
STEP 11: Add GraphQL Schema for Multi-Tenant Credentials
Add this to your schema.graphql:

amplify/backend/api/team/schema.graphql
v2
type MultiTenantCredentialsResponse @aws_iam @aws_cognito_user_pools {
  consoleUrl: String
  accessKeyId: String
  secretAccessKey: String
  sessionToken: String
  expiration: String
STEP 12: Customer Approval Email Flow (with AI/LLM Enhanced Messaging)
When your DevOps engineer creates a request for a multi-tenant customer account, and it needs the customer's approval (e.g., Facebook's cloud admin), update the notification Lambda to send a rich email:

amplify/backend/function/teamNotifications/src/multi_tenant_email.py
v2
def build_customer_approval_email(event):
    """
    Build a rich email to send to the customer admin when 
    a DevOps engineer requests access to their account.
    """
    requester = event.get('email', 'Unknown')
STEP 13: Deployment Checklist
Here's your exact sequence of actions:

A. Lambda Functions to Create/Update
#	Lambda	Action	Purpose
1	teamMultiTenantGrant	CREATE NEW	AssumeRole for external accounts
2	teamGetMultiTenantCredentials	CREATE NEW	On-demand console/CLI creds
3	teamGenerateCloudFormation	UPDATE	Multi-role CFn template
4	teamRouter	UPDATE	Multi-tenant eligibility check
5	teamNotifications	UPDATE	Customer approval emails
B. Schema Updates
#	File	Change
1	schema.graphql	Add MultiTenantCredentialsResponse type + getMultiTenantCredentials query
2	`Mutation.create	