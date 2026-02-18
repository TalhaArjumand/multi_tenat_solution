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

2. LAMBDA FUNCTIONS TO CREATE
Create: amplify/backend/function/teamGenerateCloudFormation/

Purpose: Generate CloudFormation template based on permission set

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
3. FRONTEND COMPONENTS
Create: src/components/CustomerApproval/CustomerApprovalPage.js

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
Update: src/components/Admin/CreateCustomer.js

Add permission set selector and invitation flow

JavaScript
// Add to existing CreateCustomer.js component

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
Create REST API endpoints in amplify/backend/api/team/

Add these to your API Gateway configuration:

JavaScript
// POST /generate-cloudformation
// Triggers: teamGenerateCloudFormation Lambda

// POST /send-customer-invitation  
// Triggers: teamSendCustomerInvitation Lambda

// POST /customer-invitation/details
// Gets customer details by invitation token

// POST /customer-invitation/approve
// Marks customer as approved, triggers CFN generation

// POST /customer-invitation/reject
// Marks customer as rejected

// POST /verify-customer-role
// Triggers: teamVerifyCustomerRole Lambda
5. STEP FUNCTION WORKFLOW
Create: amplify/backend/custom/customerOnboarding/customerOnboardingStateMachine.json

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
Update: amplify/backend/function/teamGrantAccess/src/index.js

Replace organization account access with AssumeRole

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
Update: src/components/Request/CreateRequest.js

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
Create: src/components/Admin/RoleStatusIndicator.js

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
MSP_ACCOUNT_ID=722560225075
PORTAL_URL=https://main.d13k6ou0ossrku.amplifyapp.com
CUSTOMERS_TABLE=Customers-aulamfydfvg5fmjl4uboxne7du-main
SENDER_EMAIL=info@sfproject.com.pk
VERIFY_ROLE_FUNCTION we havent any yet lambda function for it, you need to create it first, no idea about it yet help for this 
