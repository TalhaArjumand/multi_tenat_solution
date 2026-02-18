# IMPLEMENTATION REQUEST: CloudIQS MSP Customer Onboarding via Role-Based Trust Relationships

## CONTEXT

I have a CloudIQS MSP system (forked from AWS TEAM - Temporary Elevated Access Management) that currently uses AWS Organization invitations to onboard customer accounts. This approach is rejected by customers because they don't want to leave their AWS Organization.

**Current System:** `umair228/cloudiqs-msp` (main branch)
- React + Amplify frontend
- GraphQL API with AppSync
- DynamoDB backend
- Lambda functions
- Step Functions for workflows
- Already has: Customer management, elevated access requests, approval workflows, audit logs

**Reference Architecture:** AWS IAM Temporary Elevated Access Broker
Repository: `aws-samples/aws-iam-temporary-elevated-access-broker`
This uses the "identity broker pattern" with IAM role trust relationships instead of organization membership.

## PROBLEM STATEMENT

**Current Flow (Rejected by Customers):**
1. MSP Admin creates customer in portal
2. System sends AWS Organization invite to customer account
3. Customer account must leave their organization and join MSP's organization
4. ❌ Customers refuse because they lose control and trust

**Required New Flow (Based on Meeting Discussion):**
1. MSP Admin creates customer → selects permission set (read-only/admin/custom)
2. System sends email invitation to customer admin
3. Customer receives email with approval template
4. Customer clicks approval link → navigates to portal
5. Customer approves → downloads CloudFormation template
6. Customer runs CloudFormation in their AWS account → role established
7. System verifies role via AssumeRole test → marks as "Established ✓"
8. MSP DevOps engineers can now request access to that customer account
9. System uses AssumeRole (not organization access) to grant temporary access

## IMPORTANT: FILE PATH CORRECTIONS

This implementation guide has been updated with the CORRECT file paths based on the actual codebase:

**Frontend Components:**
- ✅ CORRECT: `src/components/Admin/Customers.js` (contains customer list AND creation modal)
- ❌ WRONG: There is NO `src/components/Admin/CreateCustomer.js` file
- ✅ CORRECT: `src/components/Requests/Request.js` (for creating access requests)
- ❌ WRONG: There is NO `src/components/Request/CreateRequest.js` file
- ✅ NEW: `src/components/CustomerApproval/CustomerApprovalPage.js` (needs to be created)
- ✅ NEW: `src/components/Admin/RoleStatusIndicator.js` (needs to be created)
- ✅ NEW: `src/components/Admin/CustomerDetails.js` (needs to be created - optional)

**Lambda Functions:**
All Lambda functions need to be created in: `amplify/backend/function/{functionName}/`

NEW Lambda Functions to Create:
1. `teamGenerateCloudFormation` - Generates CloudFormation templates
2. `teamSendCustomerInvitation` - Sends invitation emails
3. `teamVerifyCustomerRole` - Verifies customer IAM roles via AssumeRole
4. `teamScheduledRoleVerification` - Daily scheduled verification job
5. `teamCheckApprovalStatus` - Checks customer approval status
6. Supporting Lambdas for API endpoints (invitation details, approve, reject)

Existing Lambda to Update:
- The Lambda that handles access granting (likely `teamRouter` or similar) needs to be updated to use AssumeRole instead of organization access

**Environment Variables (ALREADY CONFIGURED):**
- MSP_ACCOUNT_ID=722560225075
- PORTAL_URL=https://main.d13k6ou0ossrku.amplifyapp.com
- CUSTOMERS_TABLE=Customers-aulamfydfvg5fmjl4uboxne7du-main
- SENDER_EMAIL=info@sfproject.com.pk

**New Environment Variable Needed:**
- VERIFY_ROLE_FUNCTION - ARN of teamVerifyCustomerRole Lambda (set after creating the Lambda)

## IMPLEMENTATION REQUIREMENTS

### PHASE 1: Customer Role-Based Onboarding

#### 1. DATABASE SCHEMA UPDATES

**Update `amplify/backend/api/team/schema.graphql`:**

Add these fields to the `Customers` type:

```graphql
type Customers @model
  @auth(rules: [
    { allow: groups, groups: ["team-admins"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["CustomerAdmin"], operations: [read] }
    { allow: private, operations: [read] }
  ]) {
  
  # Existing fields
  id: ID!
  name: String!
  description: String
  accountIds: [String!]
  approverGroupIds: [String]
  adminEmail: String
  adminName: String
  status: String
  createdAt: AWSDateTime
  modifiedBy: String
  
  # NEW FIELDS FOR ROLE-BASED ONBOARDING
  permissionSet: String!
    # Values: "read-only" | "admin" | "custom"
    # Determines IAM policies in CloudFormation template
  
  roleStatus: String!
    # Values: "pending_approval" | "approved" | "established" | "rejected" | "verification_failed"
    # Tracks onboarding progress
  
  roleArn: String
    # Format: "arn:aws:iam::CUSTOMER-ACCOUNT:role/CloudIQS-MSP-AccessRole"
    # Populated after customer runs CloudFormation
  
  externalId: String!
    # Unique security token for AssumeRole (UUID v4)
    # Generated when customer is created
  
  cloudFormationTemplate: String
    # Full CloudFormation YAML template as string
    # Generated based on permissionSet selection
  
  invitationToken: String
    # Secure token for approval URL (32-byte random string)
    # Used in approval link
  
  invitationSentAt: AWSDateTime
    # Timestamp when invitation email was sent
  
  invitationExpiresAt: AWSDateTime
    # Invitation expires 7 days after sending
  
  approvedAt: AWSDateTime
    # Timestamp when customer approved in portal
  
  roleEstablishedAt: AWSDateTime
    # Timestamp when role was verified via AssumeRole
  
  lastRoleVerification: AWSDateTime
    # Last time we verified role is still accessible
  
  roleVerificationError: String
    # If verification fails, store error message
}

IMPORTANT NOTE ABOUT GLOBAL SECONDARY INDEX (GSI):
The teamGetInvitationDetails Lambda function requires querying by invitationToken.
You need to add a GSI to the Customers table:
- Index name: invitationToken-index
- Partition key: invitationToken (String)

To add this in Amplify:
1. The GSI can be added using @index directive in GraphQL schema (Amplify transforms v2):
   ```graphql
   type Customers @model @auth(...) {
     # ... existing fields
     invitationToken: String @index(name: "byInvitationToken")
   }
   ```
2. Or manually add it to the DynamoDB table via CloudFormation template
3. Or add it via AWS Console after deployment

Alternatively, you can modify the teamGetInvitationDetails Lambda to scan the table instead of querying,
but this is less efficient for large datasets.

2. LAMBDA FUNCTIONS TO CREATE

IMPORTANT: To create a new Lambda function in Amplify:
1. Run: `amplify add function`
2. Select "Lambda function"
3. Provide function name (e.g., teamGenerateCloudFormation)
4. Choose runtime: Node.js or Python
5. For Node.js functions, you can add npm packages in the function's package.json
6. For Python functions, add dependencies to Pipfile

Alternatively, you can manually create the directory structure following the pattern of existing functions.

Each Lambda function directory should contain:
- src/index.js (or index.py for Python)
- function-parameters.json
- {functionName}-cloudformation-template.json
- package.json (for Node.js) or Pipfile (for Python)

Create: amplify/backend/function/teamGenerateCloudFormation/

Purpose: Generate CloudFormation template based on permission set

Runtime: Node.js
Required NPM Package: js-yaml (for YAML generation)

JavaScript
// amplify/backend/function/teamGenerateCloudFormation/src/index.js

const yaml = require('js-yaml');

const MSP_ACCOUNT_ID = process.env.MSP_ACCOUNT_ID; // Your MSP AWS account ID

function generateCloudFormationTemplate(permissionSet, externalId, customerName) {
  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `CloudIQS MSP Access Role for ${customerName}`,
    
    Parameters: {
      ExternalId: {
        Type: 'String',
        Default: externalId,
        Description: 'Security token for role assumption'
      }
    },
    
    Conditions: {
      IsReadOnly: { 'Fn::Equals': [permissionSet, 'read-only'] },
      IsAdmin: { 'Fn::Equals': [permissionSet, 'admin'] },
      IsCustom: { 'Fn::Equals': [permissionSet, 'custom'] }
    },
    
    Resources: {
      CloudIQSMSPRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: 'CloudIQS-MSP-AccessRole',
          Description: `Allows CloudIQS MSP to access this account with ${permissionSet} permissions`,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${MSP_ACCOUNT_ID}:root`
              },
              Action: 'sts:AssumeRole',
              Condition: {
                StringEquals: {
                  'sts:ExternalId': { Ref: 'ExternalId' }
                }
              }
            }]
          },
          ManagedPolicyArns: [
            // Conditional policies based on permission set
            {
              'Fn::If': [
                'IsReadOnly',
                'arn:aws:iam::aws:policy/ReadOnlyAccess',
                { Ref: 'AWS::NoValue' }
              ]
            },
            {
              'Fn::If': [
                'IsAdmin',
                'arn:aws:iam::aws:policy/AdministratorAccess',
                { Ref: 'AWS::NoValue' }
              ]
            }
          ],
          Tags: [
            { Key: 'ManagedBy', Value: 'CloudIQS-MSP' },
            { Key: 'Customer', Value: customerName }
          ]
        }
      }
    },
    
    Outputs: {
      RoleArn: {
        Description: 'ARN of the created role - provide this to CloudIQS',
        Value: { 'Fn::GetAtt': ['CloudIQSMSPRole', 'Arn'] },
        Export: { Name: 'CloudIQS-MSP-RoleArn' }
      },
      ExternalId: {
        Description: 'External ID used for role assumption',
        Value: { Ref: 'ExternalId' }
      }
    }
  };
  
  return yaml.dump(template);
}

exports.handler = async (event) => {
  const { customerId, customerName, permissionSet, externalId } = event;
  
  try {
    const cfnTemplate = generateCloudFormationTemplate(permissionSet, externalId, customerName);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        customerId,
        cloudFormationTemplate: cfnTemplate
      })
    };
  } catch (error) {
    console.error('Error generating CloudFormation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
Create: amplify/backend/function/teamSendCustomerInvitation/

Purpose: Send email invitation with approval link

JavaScript
// amplify/backend/function/teamSendCustomerInvitation/src/index.js

const AWS = require('aws-sdk');
const { randomBytes } = require('crypto');

const ses = new AWS.SES();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const PORTAL_URL = process.env.PORTAL_URL; // Your Amplify app URL
const SENDER_EMAIL = process.env.SENDER_EMAIL; // Verified SES email

function generateInvitationToken() {
  return randomBytes(32).toString('base64url');
}

function getApprovalEmailTemplate(customerName, permissionSet, approvalLink, expiresAt) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #232F3E; color: white; padding: 20px; text-align: center; }
    .content { background: #f4f4f4; padding: 30px; }
    .button { 
      display: inline-block; 
      padding: 12px 30px; 
      background: #FF9900; 
      color: white; 
      text-decoration: none; 
      border-radius: 4px;
      margin: 20px 0;
    }
    .details { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #232F3E; }
    .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudIQS MSP Access Request</h1>
    </div>
    
    <div class="content">
      <h2>Action Required: Review Access Request</h2>
      
      <p>Hello <strong>${customerName}</strong>,</p>
      
      <p>CloudIQS is requesting access to your AWS account with the following permissions:</p>
      
      <div class="details">
        <h3>Access Details</h3>
        <p><strong>Permission Level:</strong> ${permissionSet}</p>
        <p><strong>Access Type:</strong> ${getPermissionDescription(permissionSet)}</p>
        <p><strong>Duration:</strong> Ongoing (can be revoked anytime)</p>
      </div>
      
      <p>To approve this request:</p>
      <ol>
        <li>Click the approval button below</li>
        <li>Review the permission details in our portal</li>
        <li>Approve to download a CloudFormation template</li>
        <li>Run the template in your AWS account</li>
      </ol>
      
      <div style="text-align: center;">
        <a href="${approvalLink}" class="button">Review & Approve Request</a>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important:</strong>
        <ul>
          <li>This link expires on <strong>${expiresAt}</strong></li>
          <li>You maintain full control - you can revoke access anytime by deleting the IAM role</li>
          <li>Your account stays in your AWS Organization</li>
          <li>We use secure ExternalId for additional security</li>
        </ul>
      </div>
      
      <p>Questions? Contact your CloudIQS account manager.</p>
      
      <p>Best regards,<br>CloudIQS MSP Team</p>
    </div>
  </div>
</body>
</html>
  `;
}

function getPermissionDescription(permissionSet) {
  const descriptions = {
    'read-only': 'Read-only access for security assessments and monitoring',
    'admin': 'Full administrative access for managed services',
    'custom': 'Custom permissions as agreed in your service contract'
  };
  return descriptions[permissionSet] || 'Custom permissions';
}

exports.handler = async (event) => {
  const { customerId, customerName, adminEmail, permissionSet } = event;
  
  try {
    // Generate invitation token
    const invitationToken = generateInvitationToken();
    const approvalLink = `${PORTAL_URL}/customer-approval/${invitationToken}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Send email via SES
    await ses.sendEmail({
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [adminEmail]
      },
      Message: {
        Subject: {
          Data: 'CloudIQS MSP Access Request - Action Required',
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: getApprovalEmailTemplate(customerName, permissionSet, approvalLink, expiresAt.toUTCString()),
            Charset: 'UTF-8'
          }
        }
      }
    }).promise();
    
    console.log(`Invitation sent to ${adminEmail} for customer ${customerName}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        customerId,
        invitationToken,
        invitationSentAt: new Date().toISOString(),
        invitationExpiresAt: expiresAt.toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error sending invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
Create: amplify/backend/function/teamVerifyCustomerRole/

Purpose: Verify role exists and is accessible via AssumeRole

JavaScript
// amplify/backend/function/teamVerifyCustomerRole/src/index.js

const AWS = require('aws-sdk');

exports.handler = async (event) => {
  const { customerId, roleArn, externalId } = event;
  
  const sts = new AWS.STS();
  
  try {
    console.log(`Verifying role: ${roleArn} with ExternalId: ${externalId}`);
    
    // Attempt to assume the role
    const assumeRoleResult = await sts.assumeRole({
      RoleArn: roleArn,
      RoleSessionName: 'CloudIQS-RoleVerification',
      ExternalId: externalId,
      DurationSeconds: 900 // 15 minutes (minimum)
    }).promise();
    
    console.log(`Successfully assumed role for customer ${customerId}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        customerId,
        roleStatus: 'established',
        roleEstablishedAt: new Date().toISOString(),
        lastRoleVerification: new Date().toISOString(),
        verified: true,
        credentials: {
          accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
          expiration: assumeRoleResult.Credentials.Expiration
        }
      })
    };
    
  } catch (error) {
    console.error(`Role verification failed for customer ${customerId}:`, error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        customerId,
        roleStatus: 'verification_failed',
        verified: false,
        error: error.message,
        errorCode: error.code,
        roleVerificationError: `Failed to assume role: ${error.message}`
      })
    };
  }
};
Create: amplify/backend/function/teamCheckApprovalStatus/

Purpose: Check if customer has approved the invitation (used by Step Functions if implemented)

JavaScript
// amplify/backend/function/teamCheckApprovalStatus/src/index.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const { customerId } = event;
  
  try {
    const result = await dynamodb.get({
      TableName: process.env.CUSTOMERS_TABLE,
      Key: { id: customerId }
    }).promise();
    
    if (!result.Item) {
      throw new Error('Customer not found');
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        customerId,
        roleStatus: result.Item.roleStatus,
        approvedAt: result.Item.approvedAt
      })
    };
    
  } catch (error) {
    console.error('Error checking approval status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

Create: amplify/backend/function/teamGetInvitationDetails/

Purpose: Get customer details by invitation token (for public approval page)

JavaScript
// amplify/backend/function/teamGetInvitationDetails/src/index.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { invitationToken } = body;
  
  try {
    // Query DynamoDB for customer with this invitation token
    const result = await dynamodb.query({
      TableName: process.env.CUSTOMERS_TABLE,
      IndexName: 'invitationToken-index', // You may need to create this GSI
      KeyConditionExpression: 'invitationToken = :token',
      ExpressionAttributeValues: {
        ':token': invitationToken
      }
    }).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Invalid invitation token' })
      };
    }
    
    const customer = result.Items[0];
    
    // Check if invitation has expired
    const expired = new Date(customer.invitationExpiresAt) < new Date();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: customer.id,
        name: customer.name,
        permissionSet: customer.permissionSet,
        accountIds: customer.accountIds,
        roleStatus: customer.roleStatus,
        invitationExpiresAt: customer.invitationExpiresAt,
        expired
      })
    };
    
  } catch (error) {
    console.error('Error fetching invitation details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

Create: amplify/backend/function/teamApproveInvitation/

Purpose: Mark customer as approved and return CloudFormation template

JavaScript
// amplify/backend/function/teamApproveInvitation/src/index.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { invitationToken, customerId } = body;
  
  try {
    // Verify invitation token matches
    const customer = await dynamodb.get({
      TableName: process.env.CUSTOMERS_TABLE,
      Key: { id: customerId }
    }).promise();
    
    if (!customer.Item || customer.Item.invitationToken !== invitationToken) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid invitation token' })
      };
    }
    
    // Check if expired
    if (new Date(customer.Item.invitationExpiresAt) < new Date()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invitation has expired' })
      };
    }
    
    // Update customer status to approved
    await dynamodb.update({
      TableName: process.env.CUSTOMERS_TABLE,
      Key: { id: customerId },
      UpdateExpression: 'SET roleStatus = :status, approvedAt = :approvedAt',
      ExpressionAttributeValues: {
        ':status': 'approved',
        ':approvedAt': new Date().toISOString()
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Access request approved',
        cloudFormationTemplate: customer.Item.cloudFormationTemplate,
        externalId: customer.Item.externalId,
        customerId: customerId
      })
    };
    
  } catch (error) {
    console.error('Error approving invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

Create: amplify/backend/function/teamRejectInvitation/

Purpose: Mark customer as rejected

JavaScript
// amplify/backend/function/teamRejectInvitation/src/index.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const { invitationToken, customerId } = body;
  
  try {
    // Verify invitation token matches
    const customer = await dynamodb.get({
      TableName: process.env.CUSTOMERS_TABLE,
      Key: { id: customerId }
    }).promise();
    
    if (!customer.Item || customer.Item.invitationToken !== invitationToken) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid invitation token' })
      };
    }
    
    // Update customer status to rejected
    await dynamodb.update({
      TableName: process.env.CUSTOMERS_TABLE,
      Key: { id: customerId },
      UpdateExpression: 'SET roleStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'rejected'
      }
    }).promise();
    
    // TODO: Send notification to MSP admin about rejection
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Access request rejected'
      })
    };
    
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

3. FRONTEND COMPONENTS
Create NEW: src/components/CustomerApproval/CustomerApprovalPage.js

Note: This is a NEW component that needs to be created in a NEW directory.
Create the directory first: src/components/CustomerApproval/

Purpose: Public page where customers approve access requests

JavaScript
// src/components/CustomerApproval/CustomerApprovalPage.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API } from 'aws-amplify';
import { Card, Button, Alert, Descriptions, Divider, Spin, Steps, message } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Step } = Steps;

function CustomerApprovalPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    fetchInvitationDetails();
  }, [token]);
  
  async function fetchInvitationDetails() {
    try {
      setLoading(true);
      
      // Call API to get customer details by invitation token
      const response = await API.post('team', '/customer-invitation/details', {
        body: { invitationToken: token }
      });
      
      if (response.expired) {
        message.error('This invitation has expired');
        return;
      }
      
      setCustomerDetails(response);
      
      // If already approved, show CloudFormation step
      if (response.roleStatus === 'approved') {
        setApproved(true);
        setCurrentStep(2);
      }
      
      setLoading(false);
    } catch (error) {
      message.error('Invalid or expired invitation link');
      setLoading(false);
    }
  }
  
  async function handleApprove() {
    try {
      setLoading(true);
      
      // Call API to mark as approved and generate CloudFormation
      const response = await API.post('team', '/customer-invitation/approve', {
        body: {
          invitationToken: token,
          customerId: customerDetails.id
        }
      });
      
      setApproved(true);
      setCurrentStep(2);
      setCustomerDetails({ ...customerDetails, ...response });
      
      message.success('Access approved! Download the CloudFormation template below.');
      setLoading(false);
      
    } catch (error) {
      message.error('Failed to approve request');
      setLoading(false);
    }
  }
  
  async function handleReject() {
    try {
      setLoading(true);
      
      await API.post('team', '/customer-invitation/reject', {
        body: {
          invitationToken: token,
          customerId: customerDetails.id
        }
      });
      
      setRejected(true);
      message.info('Access request rejected');
      setLoading(false);
      
    } catch (error) {
      message.error('Failed to reject request');
      setLoading(false);
    }
  }
  
  function downloadCloudFormation() {
    const element = document.createElement('a');
    const file = new Blob([customerDetails.cloudFormationTemplate], { type: 'text/yaml' });
    element.href = URL.createObjectURL(file);
    element.download = `cloudiqs-msp-role-${customerDetails.name.replace(/\s+/g, '-').toLowerCase()}.yaml`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading invitation details..." />
      </div>
    );
  }
  
  if (rejected) {
    return (
      <div style={{ maxWidth: 800, margin: '50px auto', padding: 20 }}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />
            <h2>Access Request Rejected</h2>
            <p>You have rejected the CloudIQS MSP access request.</p>
            <p>No changes have been made to your AWS account.</p>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div style={{ maxWidth: 800, margin: '50px auto', padding: 20 }}>
      <Card title="CloudIQS MSP Access Request">
        
        <Steps current={currentStep} style={{ marginBottom: 30 }}>
          <Step title="Review" description="Review access details" />
          <Step title="Approve" description="Approve or reject" />
          <Step title="Deploy" description="Run CloudFormation" />
          <Step title="Complete" description="Access established" />
        </Steps>
        
        <Alert
          message="Your Account Stays Secure"
          description="You maintain full control. Your AWS account stays in your organization. You can revoke access anytime by deleting the IAM role."
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
        
        <Descriptions title="Access Request Details" bordered column={1}>
          <Descriptions.Item label="Organization">
            <strong>{customerDetails?.name}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Permission Level">
            <strong>{customerDetails?.permissionSet}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Access Type">
            {getPermissionDescription(customerDetails?.permissionSet)}
          </Descriptions.Item>
          <Descriptions.Item label="AWS Account">
            {customerDetails?.accountIds?.join(', ')}
          </Descriptions.Item>
          <Descriptions.Item label="Security">
            Secured with ExternalId token
          </Descriptions.Item>
        </Descriptions>
        
        {!approved && !rejected && (
          <>
            <Divider />
            <div style={{ textAlign: 'center' }}>
              <h3>Do you approve this access request?</h3>
              <p>By approving, you'll receive a CloudFormation template to create the access role.</p>
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />}
                size="large"
                onClick={handleApprove}
                style={{ marginRight: 10 }}
              >
                Approve Access
              </Button>
              <Button 
                danger 
                icon={<CloseCircleOutlined />}
                size="large"
                onClick={handleReject}
              >
                Reject
              </Button>
            </div>
          </>
        )}
        
        {approved && (
          <>
            <Divider />
            <Alert
              message="Step 2: Deploy CloudFormation Template"
              description="Download the CloudFormation template and run it in your AWS account to establish the access role."
              type="success"
              showIcon
              style={{ marginBottom: 20 }}
            />
            
            <Card style={{ background: '#f5f5f5' }}>
              <h3>Deployment Instructions</h3>
              <ol>
                <li><strong>Download the CloudFormation template</strong> using the button below</li>
                <li><strong>Log into your AWS Console</strong></li>
                <li><strong>Navigate to CloudFormation</strong> service</li>
                <li><strong>Click "Create Stack"</strong> → "With new resources"</li>
                <li><strong>Upload the downloaded template</strong></li>
                <li><strong>Follow the wizard</strong> and click "Create stack"</li>
                <li><strong>Wait for completion</strong> (status: CREATE_COMPLETE)</li>
              </ol>
              
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />}
                  size="large"
                  onClick={downloadCloudFormation}
                >
                  Download CloudFormation Template
                </Button>
              </div>
              
              <Alert
                message="After Deployment"
                description="Once the CloudFormation stack is created, CloudIQS will automatically verify the role. You'll receive a confirmation email when access is established."
                type="info"
                showIcon
              />
            </Card>
            
            <Divider />
            
            <Card title="What This Creates" size="small">
              <ul>
                <li><strong>IAM Role:</strong> CloudIQS-MSP-AccessRole</li>
                <li><strong>Permissions:</strong> {customerDetails.permissionSet} access</li>
                <li><strong>Trust Policy:</strong> Only CloudIQS MSP account can assume</li>
                <li><strong>Security:</strong> ExternalId verification required</li>
                <li><strong>Tags:</strong> ManagedBy: CloudIQS-MSP</li>
              </ul>
            </Card>
          </>
        )}
      </Card>
    </div>
  );
}

function getPermissionDescription(permissionSet) {
  const descriptions = {
    'read-only': 'Read-only access for security assessments and monitoring',
    'admin': 'Full administrative access for managed services',
    'custom': 'Custom permissions as defined in your service agreement'
  };
  return descriptions[permissionSet] || 'Custom permissions';
}

export default CustomerApprovalPage;
Update: src/components/Admin/Customers.js

Note: The file is Customers.js (not CreateCustomer.js). This file contains both the customer list 
and customer creation functionality in a modal dialog.

Add permission set selector and invitation flow to the existing customer creation modal.

JavaScript
// Add to existing src/components/Admin/Customers.js component

import { Select, Steps, Button, message } from 'antd';

const { Step } = Steps;

// Add to component state
const [permissionSet, setPermissionSet] = useState('read-only');
const [currentStep, setCurrentStep] = useState(0);
const [invitationSent, setInvitationSent] = useState(false);

// Add to form
<Form.Item 
  label="Permission Set" 
  required
  tooltip="Defines the level of access CloudIQS will have"
>
  <Select 
    value={permissionSet} 
    onChange={setPermissionSet}
    size="large"
  >
    <Select.Option value="read-only">
      Read-Only Access
      <br />
      <small>For security assessments and monitoring</small>
    </Select.Option>
    <Select.Option value="admin">
      Administrator Access
      <br />
      <small>For managed services and remediation</small>
    </Select.Option>
    <Select.Option value="custom">
      Custom Permissions
      <br />
      <small>As defined in service agreement</small>
    </Select.Option>
  </Select>
</Form.Item>

// Update create handler
async function handleCreateAndSendInvitation() {
  try {
    // 1. Generate ExternalId
    const externalId = crypto.randomUUID();
    
    // 2. Create customer in DynamoDB
    const customerData = {
      name: customerName,
      description: description,
      accountIds: selectedAccounts,
      approverGroupIds: selectedApprovers,
      adminEmail: adminEmail,
      adminName: adminName,
      permissionSet: permissionSet,
      roleStatus: 'pending_approval',
      externalId: externalId,
      status: 'active',
      modifiedBy: currentUser.email
    };
    
    const createResult = await API.graphql({
      query: createCustomers,
      variables: { input: customerData }
    });
    
    const customerId = createResult.data.createCustomers.id;
    
    // 3. Generate CloudFormation template
    const cfnResult = await API.post('team', '/generate-cloudformation', {
      body: {
        customerId,
        customerName,
        permissionSet,
        externalId
      }
    });
    
    // 4. Update customer with CloudFormation template
    await API.graphql({
      query: updateCustomers,
      variables: {
        input: {
          id: customerId,
          cloudFormationTemplate: cfnResult.cloudFormationTemplate
        }
      }
    });
    
    // 5. Send invitation email
    const inviteResult = await API.post('team', '/send-customer-invitation', {
      body: {
        customerId,
        customerName,
        adminEmail,
        permissionSet
      }
    });
    
    // 6. Update customer with invitation details
    await API.graphql({
      query: updateCustomers,
      variables: {
        input: {
          id: customerId,
          invitationToken: inviteResult.invitationToken,
          invitationSentAt: inviteResult.invitationSentAt,
          invitationExpiresAt: inviteResult.invitationExpiresAt
        }
      }
    });
    
    setInvitationSent(true);
    setCurrentStep(1);
    message.success('Customer created and invitation sent!');
    
  } catch (error) {
    message.error('Failed to create customer: ' + error.message);
    console.error(error);
  }
}
4. API GATEWAY ENDPOINTS

IMPORTANT: The system already has an API Gateway REST API (likely called "team").
These endpoints should be added to the existing API Gateway configuration.

In Amplify, this is typically done by:
1. Running: `amplify update api`
2. Selecting REST API
3. Adding new paths and Lambda integrations

OR by manually editing the API Gateway CloudFormation template in:
amplify/backend/api/team/ (if REST API exists there)

For each endpoint, you need to:
- Create a Lambda function to handle the request
- Add the Lambda as a target for the API Gateway path
- Configure authentication (Cognito for admin endpoints, None for public endpoints)

Endpoints to Create:

JavaScript
// POST /generate-cloudformation
// Lambda: teamGenerateCloudFormation
// Auth: Cognito/IAM Identity Center (Admin only)
// Description: Generates CloudFormation template for customer

// POST /send-customer-invitation  
// Lambda: teamSendCustomerInvitation
// Auth: Cognito/IAM Identity Center (Admin only)
// Description: Sends invitation email to customer

// POST /customer-invitation/details
// Lambda: NEW Lambda to fetch customer by invitation token
// Auth: None (public endpoint - token-based security)
// Description: Gets customer details for approval page

// POST /customer-invitation/approve
// Lambda: NEW Lambda to mark customer as approved
// Auth: None (public endpoint - token-based security)
// Description: Approves access request and returns CloudFormation template

// POST /customer-invitation/reject
// Lambda: NEW Lambda to mark customer as rejected
// Auth: None (public endpoint - token-based security)
// Description: Rejects access request

// POST /verify-customer-role
// Lambda: teamVerifyCustomerRole
// Auth: Cognito/IAM Identity Center (Admin only)
// Description: Manually trigger role verification
5. STEP FUNCTION WORKFLOW

OPTIONAL: The Step Function workflow is OPTIONAL for this implementation.
You can implement the customer onboarding flow without Step Functions by handling
the workflow logic in the Lambda functions and frontend components.

If you choose to implement Step Functions:
Create: amplify/backend/custom/customerOnboarding/customerOnboardingStateMachine.json

Note: You may need to create the directory structure and add a CloudFormation template
to deploy the Step Function. Look at existing Step Functions in amplify/backend/custom/stepfunctions/
for reference.

JSON
{
  "Comment": "Customer Onboarding Workflow",
  "StartAt": "GenerateCloudFormation",
  "States": {
    "GenerateCloudFormation": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:teamGenerateCloudFormation",
      "Next": "SendInvitation"
    },
    "SendInvitation": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:teamSendCustomerInvitation",
      "Next": "WaitForApproval"
    },
    "WaitForApproval": {
      "Type": "Wait",
      "Seconds": 300,
      "Next": "CheckApprovalStatus"
    },
    "CheckApprovalStatus": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:teamCheckApprovalStatus",
      "Next": "IsApproved"
    },
    "IsApproved": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.roleStatus",
          "StringEquals": "approved",
          "Next": "WaitForRoleCreation"
        },
        {
          "Variable": "$.roleStatus",
          "StringEquals": "rejected",
          "Next": "OnboardingRejected"
        }
      ],
      "Default": "WaitForApproval"
    },
    "WaitForRoleCreation": {
      "Type": "Wait",
      "Seconds": 600,
      "Next": "VerifyRole"
    },
    "VerifyRole": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:teamVerifyCustomerRole",
      "Next": "IsRoleEstablished"
    },
    "IsRoleEstablished": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.verified",
          "BooleanEquals": true,
          "Next": "OnboardingComplete"
        }
      ],
      "Default": "WaitForRoleCreation"
    },
    "OnboardingComplete": {
      "Type": "Succeed"
    },
    "OnboardingRejected": {
      "Type": "Fail",
      "Error": "CustomerRejected",
      "Cause": "Customer rejected the access request"
    }
  }
}
PHASE 2: Access Request Integration
6. UPDATE ELEVATED ACCESS TO USE ASSUMEROLE

Note: The current system likely uses teamRouter Lambda or a similar function for access management.
If teamGrantAccess does not exist, you'll need to identify the Lambda function that handles 
granting access to customer accounts and update that function instead.

Check amplify/backend/function/teamRouter/src/index.js or similar functions.

Update the access granting logic to use AssumeRole instead of organization account access.

JavaScript
// OLD CODE (Remove):
// const account = await getOrgAccount(accountId);

// NEW CODE (Add):
const AWS = require('aws-sdk');
const sts = new AWS.STS();

async function getCustomerByAccount(accountId) {
  // Query Customers table to find customer with this accountId
  const result = await dynamodb.query({
    TableName: process.env.CUSTOMERS_TABLE,
    IndexName: 'accountIds-index',
    KeyConditionExpression: 'accountIds = :accountId',
    ExpressionAttributeValues: {
      ':accountId': accountId
    }
  }).promise();
  
  return result.Items[0];
}

async function assumeCustomerRole(customer, requesterId) {
  if (customer.roleStatus !== 'established') {
    throw new Error(`Customer role not established. Status: ${customer.roleStatus}`);
  }
  
  try {
    const assumedRole = await sts.assumeRole({
      RoleArn: customer.roleArn,
      RoleSessionName: `CloudIQS-${requesterId}-${Date.now()}`,
      ExternalId: customer.externalId,
      DurationSeconds: 3600 // 1 hour
    }).promise();
    
    return {
      accessKeyId: assumedRole.Credentials.AccessKeyId,
      secretAccessKey: assumedRole.Credentials.SecretAccessKey,
      sessionToken: assumedRole.Credentials.SessionToken,
      expiration: assumedRole.Credentials.Expiration
    };
    
  } catch (error) {
    console.error('Failed to assume customer role:', error);
    throw new Error(`Cannot access customer account: ${error.message}`);
  }
}

// In your grant access handler:
exports.handler = async (event) => {
  const { requestId, accountId, permissionSet, requesterId } = event;
  
  // Get customer for this account
  const customer = await getCustomerByAccount(accountId);
  
  if (!customer) {
    throw new Error('Account not associated with any customer');
  }
  
  // Assume role in customer account
  const credentials = await assumeCustomerRole(customer, requesterId);
  
  // Store credentials and grant access
  // ... rest of your existing logic
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Access granted',
      accountId,
      customerName: customer.name,
      expiresAt: credentials.expiration
    })
  };
};
7. UPDATE ACCOUNT SELECTOR IN REQUEST FORM
Update: src/components/Requests/Request.js

Note: The file is Request.js (not CreateRequest.js). This is the component where users create access requests.

JavaScript
// Update account fetching
async function fetchEligibleAccounts() {
  try {
    // Fetch customers with established roles
    const customersResult = await API.graphql({
      query: listCustomers,
      variables: {
        filter: {
          roleStatus: { eq: 'established' },
          status: { eq: 'active' }
        }
      }
    });
    
    const customers = customersResult.data.listCustomers.items;
    
    // Build account list with customer context
    const accounts = customers.flatMap(customer => 
      customer.accountIds.map(accountId => ({
        value: accountId,
        label: `${customer.name} - ${accountId}`,
        customerName: customer.name,
        customerId: customer.id,
        roleStatus: customer.roleStatus,
        permissionSet: customer.permissionSet
      }))
    );
    
    setEligibleAccounts(accounts);
    
  } catch (error) {
    message.error('Failed to fetch eligible accounts');
    console.error(error);
  }
}

// Update account selector
<Select
  placeholder="Select customer account"
  options={eligibleAccounts}
  filterOption={(input, option) =>
    option.label.toLowerCase().includes(input.toLowerCase())
  }
  onChange={(value, option) => {
    setSelectedAccount(value);
    setSelectedCustomer(option);
  }}
  style={{ width: '100%' }}
/>
8. ADD ROLE STATUS INDICATORS
Create NEW: src/components/Admin/RoleStatusIndicator.js

Note: This is a NEW component that needs to be created.

JavaScript
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined 
} from '@ant-design/icons';

function RoleStatusIndicator({ status, lastVerification }) {
  const statusConfig = {
    'pending_approval': {
      icon: <ClockCircleOutlined />,
      color: 'orange',
      text: 'Pending Approval',
      description: 'Waiting for customer to approve access request'
    },
    'approved': {
      icon: <SyncOutlined spin />,
      color: 'blue',
      text: 'Approved - Awaiting Role',
      description: 'Customer approved. Waiting for CloudFormation deployment'
    },
    'established': {
      icon: <CheckCircleOutlined />,
      color: 'green',
      text: 'Role Established ✓',
      description: 'Role verified and accessible'
    },
    'rejected': {
      icon: <CloseCircleOutlined />,
      color: 'red',
      text: 'Rejected',
      description: 'Customer rejected the access request'
    },
    'verification_failed': {
      icon: <WarningOutlined />,
      color: 'red',
      text: 'Verification Failed',
      description: 'Cannot assume role. Check customer account'
    }
  };
  
  const config = statusConfig[status] || statusConfig['pending_approval'];
  
  return (
    <Tooltip title={`${config.description}${lastVerification ? `\nLast verified: ${new Date(lastVerification).toLocaleString()}` : ''}`}>
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    </Tooltip>
  );
}

export default RoleStatusIndicator;
9. ADD SCHEDULED ROLE VERIFICATION
Create: amplify/backend/function/teamScheduledRoleVerification/

Scheduled Lambda (runs daily) to verify all established roles

JavaScript
// amplify/backend/function/teamScheduledRoleVerification/src/index.js

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

exports.handler = async (event) => {
  try {
    // Get all customers with established roles
    const customers = await dynamodb.scan({
      TableName: process.env.CUSTOMERS_TABLE,
      FilterExpression: 'roleStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'established'
      }
    }).promise();
    
    console.log(`Verifying ${customers.Items.length} customer roles`);
    
    const results = [];
    
    // Verify each role
    for (const customer of customers.Items) {
      try {
        const verifyResult = await lambda.invoke({
          FunctionName: process.env.VERIFY_ROLE_FUNCTION,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            customerId: customer.id,
            roleArn: customer.roleArn,
            externalId: customer.externalId
          })
        }).promise();
        
        const result = JSON.parse(verifyResult.Payload);
        
        // Update customer with verification result
        await dynamodb.update({
          TableName: process.env.CUSTOMERS_TABLE,
          Key: { id: customer.id },
          UpdateExpression: 'SET lastRoleVerification = :timestamp, roleStatus = :status',
          ExpressionAttributeValues: {
            ':timestamp': new Date().toISOString(),
            ':status': result.verified ? 'established' : 'verification_failed'
          }
        }).promise();
        
        results.push({
          customerId: customer.id,
          customerName: customer.name,
          verified: result.verified
        });
        
      } catch (error) {
        console.error(`Verification failed for customer ${customer.id}:`, error);
        results.push({
          customerId: customer.id,
          customerName: customer.name,
          verified: false,
          error: error.message
        });
      }
    }
    
    console.log('Verification results:', JSON.stringify(results, null, 2));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        totalCustomers: customers.Items.length,
        verified: results.filter(r => r.verified).length,
        failed: results.filter(r => !r.verified).length,
        results
      })
    };
    
  } catch (error) {
    console.error('Scheduled verification failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
Add EventBridge rule to trigger daily:

Note: This EventBridge rule should be added after the teamScheduledRoleVerification Lambda is created.
You can add this to amplify/backend/custom/ as a CloudFormation template or configure it manually.

JSON
{
  "ScheduleExpression": "rate(1 day)",
  "State": "ENABLED",
  "Targets": [{
    "Arn": "arn:aws:lambda:REGION:ACCOUNT:function:teamScheduledRoleVerification",
    "Id": "DailyRoleVerification"
  }]
}

Environment Variables

IMPORTANT: These environment variables are ALREADY CONFIGURED in your system:
- MSP_ACCOUNT_ID=722560225075
- PORTAL_URL=https://main.d13k6ou0ossrku.amplifyapp.com
- CUSTOMERS_TABLE=Customers-aulamfydfvg5fmjl4uboxne7du-main
- SENDER_EMAIL=info@sfproject.com.pk

You DO NOT need to set these again. They should be referenced in your Lambda functions.

NEW Environment Variable Needed:
- VERIFY_ROLE_FUNCTION: This will be the ARN of the teamVerifyCustomerRole Lambda function.
  This needs to be set AFTER you create the teamVerifyCustomerRole Lambda function.
  Format: arn:aws:lambda:REGION:ACCOUNT:function:teamVerifyCustomerRole-{env}
  
  This variable is used by teamScheduledRoleVerification to invoke the verification Lambda.

## RECOMMENDED IMPLEMENTATION ORDER

This is the recommended order to implement the changes to minimize errors and dependencies:

### Step 1: Database Schema Update (DO THIS FIRST)
1. Update `amplify/backend/api/team/schema.graphql` to add new fields to Customers type
2. Add GSI for invitationToken if using query-based approach (or plan to use scan)
3. Run `amplify push` to deploy schema changes
4. Verify changes in DynamoDB console

### Step 2: Core Lambda Functions
Create these Lambda functions in order:
1. **teamGenerateCloudFormation** - No dependencies
   - Add js-yaml to package.json
   - Test with sample data
2. **teamVerifyCustomerRole** - No dependencies
   - Configure IAM permissions for sts:AssumeRole
   - Test with a manually created role
3. **teamSendCustomerInvitation** - No dependencies
   - Verify SES email address first
   - Test email sending
4. **teamCheckApprovalStatus** - Depends on DynamoDB schema
   - Test with sample customer data

### Step 3: API Endpoint Lambda Functions
Create these Lambda functions:
1. **teamGetInvitationDetails** - Depends on DynamoDB GSI
2. **teamApproveInvitation** - Depends on DynamoDB schema
3. **teamRejectInvitation** - Depends on DynamoDB schema

### Step 4: API Gateway Configuration
1. Add REST API endpoints to existing API Gateway
2. Connect Lambda functions to endpoints
3. Configure authentication (Cognito for admin, None for public)
4. Test each endpoint with Postman or curl

### Step 5: Frontend - Customer Approval Page (Public)
1. Create directory: `src/components/CustomerApproval/`
2. Create `CustomerApprovalPage.js`
3. Add route in App.js: `/customer-approval/:token`
4. Test with mock invitation token

### Step 6: Frontend - Admin Components
1. Create `RoleStatusIndicator.js` component
2. Update `Customers.js` to add:
   - Permission set selector in create modal
   - New columns in customer list table
   - Integration with new API endpoints
3. Test customer creation flow

### Step 7: Frontend - Request Component Update
1. Update `src/components/Requests/Request.js`
2. Modify account fetching to use Customers with roleStatus='established'
3. Test account selection shows only established customers

### Step 8: Scheduled Verification (OPTIONAL - Can be done later)
1. Create **teamScheduledRoleVerification** Lambda
2. Set VERIFY_ROLE_FUNCTION environment variable
3. Create EventBridge rule to trigger daily
4. Test manual invocation first

### Step 9: Update Access Grant Logic
1. Identify the Lambda function that grants access (teamRouter or similar)
2. Update to use AssumeRole instead of organization access
3. Add customer lookup by accountId
4. Test the full flow: Create customer → Approve → Deploy CFN → Verify → Request access

### Step 10: Step Functions (OPTIONAL)
1. Only implement if you want automated workflow orchestration
2. Create state machine in `amplify/backend/custom/customerOnboarding/`
3. Add CloudFormation template to deploy state machine
4. Integrate with customer creation flow

## TESTING CHECKLIST

After implementation, test this complete flow:

1. **Customer Creation & Invitation**
   - [ ] Admin creates customer with permission set selection
   - [ ] CloudFormation template is generated correctly
   - [ ] Invitation email is sent with correct approval link
   - [ ] Customer receives email with all details

2. **Customer Approval**
   - [ ] Customer clicks approval link
   - [ ] Approval page loads with customer details
   - [ ] Customer can approve or reject
   - [ ] After approval, CloudFormation template downloads
   - [ ] Customer status updates to 'approved'

3. **Role Deployment & Verification**
   - [ ] Customer runs CloudFormation in their AWS account
   - [ ] Role is created with correct trust policy
   - [ ] ExternalId is configured correctly
   - [ ] System verifies role via AssumeRole
   - [ ] Customer status updates to 'established'

4. **Access Request**
   - [ ] DevOps engineer creates access request
   - [ ] Only established customer accounts appear in dropdown
   - [ ] Account selection shows customer context
   - [ ] Request is submitted successfully

5. **Access Grant**
   - [ ] Request is approved
   - [ ] System uses AssumeRole to access customer account
   - [ ] Temporary credentials are generated
   - [ ] Access works as expected

6. **Scheduled Verification** (if implemented)
   - [ ] Verification runs daily
   - [ ] All established roles are checked
   - [ ] Failed verifications are logged
   - [ ] Customer status updates on failure

## TROUBLESHOOTING COMMON ISSUES

### Issue: "SES Email not verified"
**Solution:** Verify sender email in SES console, or move out of SES sandbox for production

### Issue: "Cannot assume role - Access Denied"
**Solution:** Check:
- Lambda execution role has sts:AssumeRole permission
- Customer's role trust policy includes your MSP account ID
- ExternalId matches exactly

### Issue: "Invitation token not found"
**Solution:** 
- Verify GSI is created on invitationToken field
- Or modify Lambda to use scan instead of query
- Check token is being stored correctly

### Issue: "CloudFormation template invalid"
**Solution:** 
- Test template in AWS CloudFormation console
- Verify YAML syntax with online validator
- Check MSP_ACCOUNT_ID environment variable is set

### Issue: "Cannot query DynamoDB - Index not found"
**Solution:**
- Add GSI to Customers table for invitationToken
- Or modify teamGetInvitationDetails to use scan
- Verify Amplify schema has @index directive

## SECURITY CONSIDERATIONS

1. **ExternalId**: Always use ExternalId in AssumeRole to prevent confused deputy problem
2. **Invitation Tokens**: Use cryptographically secure random tokens (crypto.randomBytes)
3. **Token Expiration**: Enforce 7-day expiration on invitation tokens
4. **Rate Limiting**: Consider adding rate limiting to public API endpoints
5. **Email Verification**: Verify customer email addresses before sending invitations
6. **Audit Logging**: Log all AssumeRole operations and access grants
7. **Least Privilege**: Encourage customers to use read-only permission set when possible

## ADDITIONAL NOTES

- This implementation maintains backward compatibility - existing organization-based customers can continue to work
- You can run both approaches in parallel during transition period
- Consider adding metrics and monitoring for role verification failures
- Document the customer onboarding process for your customer success team
- Create CloudFormation template examples for common use cases

---

**END OF IMPLEMENTATION GUIDE** 
