/* Amplify Params - DO NOT EDIT
	API_TEAM_GRAPHQLAPIENDPOINTOUTPUT
	API_TEAM_GRAPHQLAPIIDOUTPUT
	AUTH_TEAM06DBB7FC_USERPOOLID
	ENV
	PORTAL_INVITE_EXPIRY_HOURS
	PORTAL_URL
	REGION
	SENDER_EMAIL
Amplify Params - DO NOT EDIT */

import { randomBytes, createHash } from 'crypto';
import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand
} from '@aws-sdk/client-cognito-identity-provider';

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;
const USER_POOL_ID = process.env.AUTH_TEAM06DBB7FC_USERPOOLID;
const PORTAL_URL = process.env.PORTAL_URL || 'https://main.d13k6ou0ossrku.amplifyapp.com';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'info@sfproject.com.pk';
const PORTAL_INVITE_EXPIRY_HOURS = parseInt(process.env.PORTAL_INVITE_EXPIRY_HOURS || '24', 10);
const PORTAL_PROVISIONING_VERSION = 'v1';

const sesClient = new SESClient({ region: REGION });
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

const getCustomerQuery = /* GraphQL */ `
  query GetCustomers($id: ID!) {
    getCustomers(id: $id) {
      id
      name
      adminEmail
      adminName
      roleStatus
      externalId
      accountIds
      portalUserEmail
      portalUserSub
      portalUserStatus
      portalUserCreatedAt
      portalInviteTokenHash
      portalInviteExpiresAt
      portalInviteSentAt
      portalInviteStatus
      portalInviteError
      portalProvisioningVersion
    }
  }
`;

const updateCustomerMutation = /* GraphQL */ `
  mutation UpdateCustomers(
    $input: UpdateCustomersInput!
    $condition: ModelCustomersConditionInput
  ) {
    updateCustomers(input: $input, condition: $condition) {
      id
      portalUserEmail
      portalUserSub
      portalUserStatus
      portalUserCreatedAt
      portalInviteExpiresAt
      portalInviteSentAt
      portalInviteStatus
      portalInviteError
      portalProvisioningVersion
    }
  }
`;

function structuredLog(event, details = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

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

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createInviteToken() {
  return randomBytes(32).toString('base64url');
}

function generateInternalPassword() {
  return `Ciq!9${randomBytes(24).toString('base64url')}Aa`;
}

function getAttributeValue(attributes, name) {
  return (attributes || []).find((attribute) => attribute.Name === name)?.Value || null;
}

function buildPortalInviteEmail({ customerName, adminName, portalUserEmail, setupUrl, expiresAt }) {
  const expiryDisplay = new Date(expiresAt).toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC'
  });

  return {
    subject: `Your CloudIQS Portal Access is Ready`,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1f3b5b; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #0b6fb8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0; }
    .info-box { background: white; padding: 16px; border-left: 4px solid #0b6fb8; margin: 16px 0; }
    .footer { color: #666; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudIQS Portal Access Ready</h1>
    </div>
    <div class="content">
      <p>Hello ${adminName || 'Administrator'},</p>
      <p>Your CloudIQS portal access for <strong>${customerName}</strong> is ready.</p>

      <div class="info-box">
        <p><strong>Portal:</strong> ${PORTAL_URL}/customer</p>
        <p><strong>Login email:</strong> ${portalUserEmail}</p>
        <p><strong>Invite expires:</strong> ${expiryDisplay} UTC</p>
      </div>

      <p>Use the link below to complete your portal setup. For security, this link is time-bounded and no password is included in this email.</p>

      <div style="text-align: center;">
        <a href="${setupUrl}" class="button">Complete Portal Setup</a>
      </div>

      <p>Once setup is complete, you will be able to sign in and access your customer-scoped dashboard.</p>

      <div class="footer">
        <p>CloudIQS MSP</p>
        <p>If you did not expect this email, contact support at ${SENDER_EMAIL}.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    textBody: `
CloudIQS Portal Access Ready

Hello ${adminName || 'Administrator'},

Your CloudIQS portal access for ${customerName} is ready.

Portal: ${PORTAL_URL}/customer
Login email: ${portalUserEmail}
Invite expires: ${expiryDisplay} UTC

Complete portal setup here:
${setupUrl}

No password is included in this email. If you did not expect this email, contact support at ${SENDER_EMAIL}.
    `
  };
}

async function sendPortalInvite(recipientEmail, emailContent) {
  structuredLog('CUSTOMER_PORTAL_INVITE_SEND_REQUEST', {
    source: SENDER_EMAIL,
    recipientEmail,
    configurationSetName: null
  });

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

  return sesClient.send(command);
}

async function ensurePortalUser(email) {
  const username = normalizeEmail(email);
  const now = new Date().toISOString();

  try {
    const existing = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username
    }));

    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' }
      ]
    }));

    return {
      status: 'created',
      createdAt: now,
      userSub: getAttributeValue(existing.UserAttributes, 'sub')
    };
  } catch (error) {
    if (error.name !== 'UserNotFoundException') {
      throw error;
    }
  }

  const temporaryPassword = generateInternalPassword();
  await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
    TemporaryPassword: temporaryPassword,
    MessageAction: 'SUPPRESS',
    DesiredDeliveryMediums: ['EMAIL'],
    UserAttributes: [
      { Name: 'email', Value: username },
      { Name: 'email_verified', Value: 'true' }
    ]
  }));

  await cognitoClient.send(new AdminSetUserPasswordCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: generateInternalPassword(),
    Permanent: true
  }));

  const created = await cognitoClient.send(new AdminGetUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username
  }));

  return {
    status: 'created',
    createdAt: now,
    userSub: getAttributeValue(created.UserAttributes, 'sub')
  };
}

async function updateCustomer(input) {
  await graphqlRequest(updateCustomerMutation, { input });
}

function buildFailureUpdate(customerId, message, adminEmail = null) {
  return {
    id: customerId,
    portalUserEmail: adminEmail,
    portalUserStatus: 'failed',
    portalInviteStatus: 'failed',
    portalInviteError: message,
    portalProvisioningVersion: PORTAL_PROVISIONING_VERSION
  };
}

export const handler = async (event) => {
  const args = event.arguments || event;
  const customerId = args.customerId;

  structuredLog('CUSTOMER_PORTAL_PROVISION_STARTED', { customerId });

  if (!customerId) {
    return { success: false, error: 'Missing required field: customerId' };
  }

  try {
    const customer = (await graphqlRequest(getCustomerQuery, { id: customerId })).getCustomers;

    if (!customer) {
      structuredLog('CUSTOMER_PORTAL_PROVISION_FAILED', { customerId, errorCode: 'CUSTOMER_NOT_FOUND' });
      return { success: false, customerId, error: 'Customer not found' };
    }

    if (customer.portalProvisioningVersion === PORTAL_PROVISIONING_VERSION &&
      ['sent', 'consumed', 'failed', 'expired'].includes(customer.portalInviteStatus || '')) {
      structuredLog('CUSTOMER_PORTAL_PROVISION_SKIPPED', {
        customerId,
        portalInviteStatus: customer.portalInviteStatus,
        portalUserStatus: customer.portalUserStatus
      });
      return {
        success: true,
        customerId,
        skipped: true,
        portalInviteStatus: customer.portalInviteStatus
      };
    }

    if (customer.roleStatus !== 'established') {
      const errorMessage = 'CUSTOMER_NOT_ESTABLISHED';
      await updateCustomer(buildFailureUpdate(customerId, errorMessage, customer.adminEmail || null));
      structuredLog('CUSTOMER_PORTAL_PROVISION_FAILED', { customerId, errorCode: errorMessage });
      return { success: false, customerId, error: errorMessage };
    }

    const adminEmail = normalizeEmail(customer.adminEmail);
    if (!adminEmail) {
      const errorMessage = 'MISSING_ADMIN_EMAIL';
      await updateCustomer(buildFailureUpdate(customerId, errorMessage));
      structuredLog('CUSTOMER_PORTAL_PROVISION_FAILED', { customerId, errorCode: errorMessage });
      return { success: false, customerId, error: errorMessage };
    }

    if (!customer.externalId) {
      const errorMessage = 'MISSING_EXTERNAL_ID';
      await updateCustomer(buildFailureUpdate(customerId, errorMessage, adminEmail));
      structuredLog('CUSTOMER_PORTAL_PROVISION_FAILED', { customerId, errorCode: errorMessage, adminEmail });
      return { success: false, customerId, error: errorMessage };
    }

    if (!Array.isArray(customer.accountIds) || customer.accountIds.length === 0) {
      const errorMessage = 'MISSING_ACCOUNT_IDS';
      await updateCustomer(buildFailureUpdate(customerId, errorMessage, adminEmail));
      structuredLog('CUSTOMER_PORTAL_PROVISION_FAILED', { customerId, errorCode: errorMessage, adminEmail });
      return { success: false, customerId, error: errorMessage };
    }

    const portalUser = await ensurePortalUser(adminEmail);
    const inviteToken = createInviteToken();
    const inviteTokenHash = hashToken(inviteToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PORTAL_INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    const sentAt = now.toISOString();
    const setupUrl = `${PORTAL_URL}/customer-setup?token=${encodeURIComponent(inviteToken)}`;

    const emailContent = buildPortalInviteEmail({
      customerName: customer.name,
      adminName: customer.adminName,
      portalUserEmail: adminEmail,
      setupUrl,
      expiresAt
    });

    const emailResponse = await sendPortalInvite(adminEmail, emailContent);

    await updateCustomer({
      id: customerId,
      portalUserEmail: adminEmail,
      portalUserSub: portalUser.userSub,
      portalUserStatus: 'created',
      portalUserCreatedAt: customer.portalUserCreatedAt || portalUser.createdAt,
      portalInviteTokenHash: inviteTokenHash,
      portalInviteExpiresAt: expiresAt,
      portalInviteSentAt: sentAt,
      portalInviteStatus: 'sent',
      portalInviteError: null,
      portalProvisioningVersion: PORTAL_PROVISIONING_VERSION
    });

    structuredLog('CUSTOMER_PORTAL_INVITE_SENT', {
      customerId,
      adminEmail,
      portalInviteStatus: 'sent',
      messageId: emailResponse.MessageId
    });

    return {
      success: true,
      customerId,
      portalInviteStatus: 'sent',
      portalUserStatus: 'created',
      expiresAt
    };
  } catch (error) {
    console.error('Customer portal provisioning error:', error);
    try {
      await updateCustomer(buildFailureUpdate(customerId, error.message));
    } catch (updateError) {
      console.error('Failed to persist portal provisioning error:', updateError);
    }

    structuredLog('CUSTOMER_PORTAL_PROVISION_FAILED', {
      customerId,
      errorCode: error.name || 'UNKNOWN_ERROR',
      errorMessage: error.message
    });

    return {
      success: false,
      customerId,
      error: error.message
    };
  }
};
