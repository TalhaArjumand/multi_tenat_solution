import { createHash } from 'crypto';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const REGION = process.env.REGION;
const CUSTOMERS_TABLE_NAME = process.env.CUSTOMERS_TABLE_NAME;
const INVITE_TOKEN_INDEX_NAME = 'byPortalInviteTokenHash';

const dynamoClient = new DynamoDBClient({ region: REGION });

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

  const items = (result.Items || []).map((item) => unmarshall(item));
  return items;
}

async function updateInviteStatus(customerId, inviteStatus, inviteError = null, consumedAt = null) {
  const names = {
    '#status': 'portalInviteStatus',
    '#error': 'portalInviteError'
  };
  const values = {
    ':status': { S: inviteStatus }
  };
  let updateExpression = 'SET #status = :status';

  if (inviteError === null) {
    updateExpression += ' REMOVE #error';
  } else {
    values[':error'] = { S: inviteError };
    updateExpression += ', #error = :error';
  }

  if (consumedAt) {
    names['#consumedAt'] = 'portalInviteConsumedAt';
    values[':consumedAt'] = { S: consumedAt };
    updateExpression += ', #consumedAt = :consumedAt';
  }

  await dynamoClient.send(new UpdateItemCommand({
    TableName: CUSTOMERS_TABLE_NAME,
    Key: {
      id: { S: customerId }
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values
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

  return { ok: true, expiresAt: customer.portalInviteExpiresAt };
}

export const handler = async (event) => {
  const parsedBody = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : null;
  const inviteToken = event.arguments?.inviteToken || event.inviteToken || parsedBody?.inviteToken || null;

  if (!CUSTOMERS_TABLE_NAME) {
    structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_FAILED', { errorCode: 'CUSTOMERS_TABLE_NAME_MISSING' });
    return buildResponse(event, {
      success: false,
      errorCode: 'CUSTOMERS_TABLE_NAME_MISSING',
      error: 'Customer invite lookup is not configured'
    }, 500);
  }

  if (!inviteToken) {
    structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_FAILED', { errorCode: 'MISSING_INVITE_TOKEN' });
    return buildResponse(event, {
      success: false,
      errorCode: 'MISSING_INVITE_TOKEN',
      error: 'Missing required field: inviteToken'
    }, 400);
  }

  try {
    const tokenHash = hashToken(inviteToken);
    const customers = await findCustomerByInviteTokenHash(tokenHash);

    if (customers.length === 0) {
      structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_FAILED', { errorCode: 'TOKEN_NOT_FOUND' });
      return buildResponse(event, {
        success: false,
        errorCode: 'TOKEN_NOT_FOUND',
        error: 'Invite token is invalid or unavailable'
      }, 404);
    }

    if (customers.length > 1) {
      structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_FAILED', { errorCode: 'TOKEN_AMBIGUOUS', matches: customers.length });
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
        await updateInviteStatus(customer.id, 'expired', validation.error);
      }

      structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_FAILED', {
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
        portalInviteExpiresAt: customer.portalInviteExpiresAt || null,
        portalInviteConsumedAt: customer.portalInviteConsumedAt || null,
        errorCode: validation.errorCode,
        error: validation.error
      }, validation.errorCode === 'TOKEN_EXPIRED' ? 410 : 403);
    }

    structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_OK', {
      customerId: customer.id,
      portalInviteStatus: customer.portalInviteStatus,
      portalInviteExpiresAt: customer.portalInviteExpiresAt
    });

    return buildResponse(event, {
      success: true,
      customerId: customer.id,
      customerName: customer.name,
      portalUserEmail: customer.portalUserEmail || customer.adminEmail || null,
      portalInviteStatus: customer.portalInviteStatus,
      portalInviteExpiresAt: customer.portalInviteExpiresAt,
      portalInviteConsumedAt: customer.portalInviteConsumedAt || null,
      errorCode: null,
      error: null
    });
  } catch (error) {
    structuredLog('CUSTOMER_PORTAL_SETUP_VALIDATE_FAILED', {
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
