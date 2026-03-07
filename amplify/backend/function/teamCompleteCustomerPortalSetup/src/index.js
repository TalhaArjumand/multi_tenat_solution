import { createHash } from 'crypto';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.REGION;
const CUSTOMERS_TABLE_NAME = process.env.CUSTOMERS_TABLE_NAME;
const USER_POOL_ID = process.env.AUTH_TEAM06DBB7FC_USERPOOLID;
const INVITE_TOKEN_INDEX_NAME = 'byPortalInviteTokenHash';

const dynamoClient = new DynamoDBClient({ region: REGION });
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

function structuredLog(event, details = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function buildResponse(event, payload, statusCode = 200) {
  if (event.arguments) {
    return payload;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(payload)
  };
}

async function findCustomerByInviteTokenHash(tokenHash) {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: CUSTOMERS_TABLE_NAME,
    IndexName: INVITE_TOKEN_INDEX_NAME,
    KeyConditionExpression: 'portalInviteTokenHash = :tokenHash',
    ExpressionAttributeValues: {
      ':tokenHash': { S: tokenHash }
    },
    Limit: 2
  }));

  return (result.Items || []).map((item) => unmarshall(item));
}

async function markInviteExpired(customerId, errorMessage) {
  await dynamoClient.send(new UpdateItemCommand({
    TableName: CUSTOMERS_TABLE_NAME,
    Key: { id: { S: customerId } },
    UpdateExpression: 'SET #status = :status, #error = :error',
    ExpressionAttributeNames: {
      '#status': 'portalInviteStatus',
      '#error': 'portalInviteError'
    },
    ExpressionAttributeValues: {
      ':status': { S: 'expired' },
      ':error': { S: errorMessage }
    }
  }));
}

async function consumeInvite(customer, consumedAt) {
  await dynamoClient.send(new UpdateItemCommand({
    TableName: CUSTOMERS_TABLE_NAME,
    Key: { id: { S: customer.id } },
    UpdateExpression: 'SET #status = :consumed, #consumedAt = :consumedAt REMOVE #error',
    ConditionExpression: '#tokenHash = :tokenHash AND #status = :sent',
    ExpressionAttributeNames: {
      '#status': 'portalInviteStatus',
      '#consumedAt': 'portalInviteConsumedAt',
      '#error': 'portalInviteError',
      '#tokenHash': 'portalInviteTokenHash'
    },
    ExpressionAttributeValues: {
      ':consumed': { S: 'consumed' },
      ':consumedAt': { S: consumedAt },
      ':sent': { S: 'sent' },
      ':tokenHash': { S: customer.portalInviteTokenHash }
    }
  }));
}

function validateInvite(customer) {
  const inviteStatus = customer.portalInviteStatus || 'not_sent';
  const now = new Date();
  const expiresAt = customer.portalInviteExpiresAt ? new Date(customer.portalInviteExpiresAt) : null;

  if (!customer.portalInviteTokenHash) {
    return { ok: false, errorCode: 'TOKEN_NOT_FOUND', error: 'Invite token is invalid or unavailable' };
  }

  if (inviteStatus === 'consumed') {
    return { ok: false, errorCode: 'TOKEN_ALREADY_USED', error: 'Invite token has already been used' };
  }

  if (inviteStatus === 'expired') {
    return { ok: false, errorCode: 'TOKEN_EXPIRED', error: 'Invite token has expired' };
  }

  if (inviteStatus !== 'sent') {
    return { ok: false, errorCode: 'TOKEN_NOT_ACTIVE', error: 'Invite token is not active' };
  }

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return { ok: false, errorCode: 'TOKEN_EXPIRY_INVALID', error: 'Invite token expiry is invalid' };
  }

  if (now > expiresAt) {
    return { ok: false, errorCode: 'TOKEN_EXPIRED', error: 'Invite token has expired', markExpired: true };
  }

  return { ok: true };
}

export const handler = async (event) => {
  const parsedBody = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : null;
  const inviteToken = event.arguments?.inviteToken || event.inviteToken || parsedBody?.inviteToken || null;
  const password = event.arguments?.password || event.password || parsedBody?.password || null;

  if (!CUSTOMERS_TABLE_NAME || !USER_POOL_ID) {
    structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', { errorCode: 'SETUP_CONFIGURATION_MISSING' });
    return buildResponse(event, {
      success: false,
      errorCode: 'SETUP_CONFIGURATION_MISSING',
      error: 'Customer setup is not configured correctly'
    }, 500);
  }

  if (!inviteToken || !password) {
    structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', { errorCode: 'MISSING_REQUIRED_FIELDS' });
    return buildResponse(event, {
      success: false,
      errorCode: 'MISSING_REQUIRED_FIELDS',
      error: 'Missing required fields: inviteToken and password'
    }, 400);
  }

  try {
    const tokenHash = hashToken(inviteToken);
    const customers = await findCustomerByInviteTokenHash(tokenHash);

    if (customers.length === 0) {
      structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', { errorCode: 'TOKEN_NOT_FOUND' });
      return buildResponse(event, {
        success: false,
        errorCode: 'TOKEN_NOT_FOUND',
        error: 'Invite token is invalid or unavailable'
      }, 404);
    }

    if (customers.length > 1) {
      structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', { errorCode: 'TOKEN_AMBIGUOUS', matches: customers.length });
      return buildResponse(event, {
        success: false,
        errorCode: 'TOKEN_AMBIGUOUS',
        error: 'Invite token resolved to multiple customers'
      }, 409);
    }

    const customer = customers[0];
    const validation = validateInvite(customer);

    if (!validation.ok) {
      if (validation.markExpired) {
        await markInviteExpired(customer.id, validation.error);
      }

      structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', {
        customerId: customer.id,
        errorCode: validation.errorCode,
        portalInviteStatus: customer.portalInviteStatus || 'not_sent'
      });

      return buildResponse(event, {
        success: false,
        customerId: customer.id,
        customerName: customer.name,
        portalUserEmail: customer.portalUserEmail || customer.adminEmail || null,
        portalInviteStatus: validation.errorCode === 'TOKEN_EXPIRED' ? 'expired' : customer.portalInviteStatus || 'not_sent',
        portalInviteConsumedAt: customer.portalInviteConsumedAt || null,
        errorCode: validation.errorCode,
        error: validation.error
      }, validation.errorCode === 'TOKEN_EXPIRED' ? 410 : 403);
    }

    if (customer.roleStatus !== 'established') {
      structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', {
        customerId: customer.id,
        errorCode: 'CUSTOMER_NOT_ESTABLISHED'
      });

      return buildResponse(event, {
        success: false,
        customerId: customer.id,
        errorCode: 'CUSTOMER_NOT_ESTABLISHED',
        error: 'Customer portal access is not established'
      }, 403);
    }

    const portalUserEmail = (customer.portalUserEmail || customer.adminEmail || '').trim().toLowerCase();
    if (!portalUserEmail) {
      structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', { customerId: customer.id, errorCode: 'MISSING_PORTAL_USER_EMAIL' });
      return buildResponse(event, {
        success: false,
        customerId: customer.id,
        errorCode: 'MISSING_PORTAL_USER_EMAIL',
        error: 'Customer portal user email is missing'
      }, 400);
    }

    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: portalUserEmail,
      Password: password,
      Permanent: true
    }));

    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: portalUserEmail,
      UserAttributes: [
        { Name: 'email', Value: portalUserEmail },
        { Name: 'email_verified', Value: 'true' }
      ]
    }));

    const consumedAt = new Date().toISOString();
    await consumeInvite(customer, consumedAt);

    structuredLog('CUSTOMER_PORTAL_SETUP_CONSUMED', {
      customerId: customer.id,
      portalUserEmail,
      portalInviteStatus: 'consumed'
    });

    return buildResponse(event, {
      success: true,
      customerId: customer.id,
      customerName: customer.name,
      portalUserEmail,
      portalInviteStatus: 'consumed',
      portalInviteConsumedAt: consumedAt,
      errorCode: null,
      error: null
    });
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', {
        errorCode: 'TOKEN_ALREADY_USED'
      });

      return buildResponse(event, {
        success: false,
        errorCode: 'TOKEN_ALREADY_USED',
        error: 'Invite token has already been used'
      }, 409);
    }

    structuredLog('CUSTOMER_PORTAL_SETUP_CONSUME_FAILED', {
      errorCode: error.name || 'UNKNOWN_ERROR',
      errorMessage: error.message
    });

    return buildResponse(event, {
      success: false,
      errorCode: error.name || 'UNKNOWN_ERROR',
      error: error.message
    }, 500);
  }
};
