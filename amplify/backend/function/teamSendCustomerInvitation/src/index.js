/* Amplify Params - DO NOT EDIT
	API_TEAM_GRAPHQLAPIENDPOINTOUTPUT
	API_TEAM_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
	PORTAL_URL
	SENDER_EMAIL
Amplify Params - DO NOT EDIT */

import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;
const PORTAL_URL = process.env.PORTAL_URL || 'https://main.d13k6ou0ossrku.amplifyapp.com';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'info@sfproject.com.pk';
const INVITATION_EXPIRY_DAYS = parseInt(process.env.INVITATION_EXPIRY_DAYS || '7', 10);

const sesClient = new SESClient({ region: REGION });

const updateCustomerMutation = /* GraphQL */ `
  mutation UpdateCustomers(
    $input: UpdateCustomersInput!
    $condition: ModelCustomersConditionInput
  ) {
    updateCustomers(input: $input, condition: $condition) {
      id
      name
      invitationToken
      invitationSentAt
      invitationExpiresAt
    }
  }
`;

async function graphqlRequest(query, variables) {
  const endpoint = new URL(GRAPHQL_ENDPOINT);
  
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: 'appsync',
    sha256: Sha256
  });

  const requestToBeSigned = new HttpRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.host
    },
    hostname: endpoint.host,
    body: JSON.stringify({ query, variables }),
    path: endpoint.pathname
  });

  const signed = await signer.sign(requestToBeSigned);
  const request = new Request(GRAPHQL_ENDPOINT, signed);

  const response = await fetch(request);
  const body = await response.json();
  
  if (body.errors) {
    console.error('GraphQL errors:', JSON.stringify(body.errors, null, 2));
    throw new Error(`GraphQL Error: ${body.errors[0].message}`);
  }
  
  return body.data;
}

function generateInvitationEmail(customerName, adminName, approvalUrl, permissionSet, expiresAt) {
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const permissionDescription = {
    'read-only': 'Read-Only Access (view resources only)',
    'admin': 'Administrator Access (full control)',
    'custom': 'Custom Access (based on specific requirements)'
  }[permissionSet] || 'Unspecified';
  
  return {
    subject: `CloudIQS MSP Access Request for ${customerName}`,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .button:hover { background: #5568d3; }
    .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #667eea; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 CloudIQS MSP Access Request</h1>
    </div>
    <div class="content">
      <p>Hello ${adminName || 'Administrator'},</p>
      
      <p>CloudIQS MSP is requesting secure access to your AWS account <strong>${customerName}</strong>.</p>
      
      <div class="info-box">
        <h3>📋 Access Details</h3>
        <p><strong>Organization:</strong> ${customerName}</p>
        <p><strong>Permission Level:</strong> ${permissionDescription}</p>
        <p><strong>Valid Until:</strong> ${expiryDate}</p>
      </div>
      
      <h3>🚀 Next Steps</h3>
      <p>To grant CloudIQS MSP secure access to your AWS account:</p>
      <ol>
        <li>Click the approval button below to review the request</li>
        <li>Approve the request and download the CloudFormation template</li>
        <li>Run the template in your AWS account to establish the trust relationship</li>
        <li>We'll automatically verify the setup once complete</li>
      </ol>
      
      <div style="text-align: center;">
        <a href="${approvalUrl}" class="button">Review & Approve Request</a>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important:</strong> This invitation expires on ${expiryDate}. You'll need to approve and deploy the CloudFormation template before this date.
      </div>
      
      <h3>🔒 Security Note</h3>
      <p>This approach uses AWS IAM role trust relationships, allowing you to maintain full control of your AWS organization. You can revoke access at any time by deleting the IAM role.</p>
      
      <p>If you have any questions or did not expect this request, please contact CloudIQS MSP support immediately.</p>
      
      <div class="footer">
        <p>CloudIQS MSP - Secure Temporary Elevated Access Management</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    textBody: `
CloudIQS MSP Access Request

Hello ${adminName || 'Administrator'},

CloudIQS MSP is requesting secure access to your AWS account ${customerName}.

ACCESS DETAILS:
- Organization: ${customerName}
- Permission Level: ${permissionDescription}
- Valid Until: ${expiryDate}

NEXT STEPS:
1. Visit the approval URL: ${approvalUrl}
2. Review and approve the request
3. Download the CloudFormation template
4. Run the template in your AWS account
5. We'll automatically verify the setup

IMPORTANT: This invitation expires on ${expiryDate}.

SECURITY NOTE:
This approach uses AWS IAM role trust relationships, allowing you to maintain full control of your AWS organization. You can revoke access at any time by deleting the IAM role.

If you have any questions or did not expect this request, please contact CloudIQS MSP support immediately.

CloudIQS MSP - Secure Temporary Elevated Access Management
This is an automated message. Please do not reply to this email.
    `
  };
}

async function sendInvitationEmail(recipientEmail, emailContent) {
  const command = new SendEmailCommand({
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [recipientEmail]
    },
    Message: {
      Subject: {
        Data: emailContent.subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: emailContent.htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: emailContent.textBody,
          Charset: 'UTF-8'
        }
      }
    }
  });
  
  const response = await sesClient.send(command);
  return response;
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    const { customerId, customerName, adminEmail, adminName, invitationToken, permissionSet } = event;
    
    // Validate required fields
    if (!customerId || !customerName || !adminEmail || !invitationToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['customerId', 'customerName', 'adminEmail', 'invitationToken']
        })
      };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid email address format'
        })
      };
    }
    
    const approvalUrl = `${PORTAL_URL}/customer-approval?token=${invitationToken}`;
    const sentAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    // Generate and send email
    const emailContent = generateInvitationEmail(
      customerName, 
      adminName, 
      approvalUrl, 
      permissionSet || 'read-only',
      expiresAt
    );
    
    const sesResponse = await sendInvitationEmail(adminEmail, emailContent);
    console.log('Email sent successfully:', sesResponse.MessageId);
    
    // Update customer with invitation details
    const updateInput = {
      id: customerId,
      invitationSentAt: sentAt,
      invitationExpiresAt: expiresAt
    };
    
    await graphqlRequest(updateCustomerMutation, { input: updateInput });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        customerId,
        messageId: sesResponse.MessageId,
        sentAt,
        expiresAt,
        approvalUrl
      })
    };
  } catch (error) {
    console.error('Error sending invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
