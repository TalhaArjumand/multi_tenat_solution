import { createHash } from 'crypto';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const REGION = process.env.REGION;
const CUSTOMERS_TABLE_NAME = process.env.CUSTOMERS_TABLE_NAME;

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

async function findCustomersByUnsubscribeHash(tokenHash) {
  const result = await dynamoClient.send(new ScanCommand({
    TableName: CUSTOMERS_TABLE_NAME,
    FilterExpression: 'notificationUnsubscribeTokenHash = :tokenHash',
    ExpressionAttributeValues: {
      ':tokenHash': { S: tokenHash }
    }
  }));

  return (result.Items || []).map((item) => unmarshall(item));
}

async function disableNotifications(customerId, unsubscribedAt, tokenHash) {
  await dynamoClient.send(new UpdateItemCommand({
    TableName: CUSTOMERS_TABLE_NAME,
    Key: {
      id: { S: customerId }
    },
    UpdateExpression: 'SET notificationsEnabled = :disabled, notificationUnsubscribedAt = :unsubscribedAt REMOVE notificationUnsubscribeTokenHash',
    ConditionExpression: 'notificationUnsubscribeTokenHash = :tokenHash',
    ExpressionAttributeValues: {
      ':disabled': { BOOL: false },
      ':unsubscribedAt': { S: unsubscribedAt },
      ':tokenHash': { S: tokenHash }
    }
  }));
}

export const handler = async (event) => {
  const parsedBody = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : null;
  const unsubscribeToken = event.arguments?.unsubscribeToken || event.unsubscribeToken || parsedBody?.unsubscribeToken || null;

  if (!CUSTOMERS_TABLE_NAME) {
    structuredLog('CUSTOMER_NOTIFICATION_UNSUBSCRIBE_FAILED', { errorCode: 'CUSTOMERS_TABLE_NAME_MISSING' });
    return buildResponse(event, {
      success: false,
      errorCode: 'CUSTOMERS_TABLE_NAME_MISSING',
      error: 'Customer notification unsubscribe is not configured'
    }, 500);
  }

  if (!unsubscribeToken) {
    structuredLog('CUSTOMER_NOTIFICATION_UNSUBSCRIBE_FAILED', { errorCode: 'MISSING_UNSUBSCRIBE_TOKEN' });
    return buildResponse(event, {
      success: false,
      errorCode: 'MISSING_UNSUBSCRIBE_TOKEN',
      error: 'Missing required field: unsubscribeToken'
    }, 400);
  }

  try {
    const tokenHash = hashToken(unsubscribeToken);
    const customers = await findCustomersByUnsubscribeHash(tokenHash);

    if (customers.length === 0) {
      structuredLog('CUSTOMER_NOTIFICATION_UNSUBSCRIBE_FAILED', { errorCode: 'TOKEN_NOT_FOUND' });
      return buildResponse(event, {
        success: false,
        errorCode: 'TOKEN_NOT_FOUND',
        error: 'Unsubscribe token is invalid or unavailable'
      }, 404);
    }

    if (customers.length > 1) {
      structuredLog('CUSTOMER_NOTIFICATION_UNSUBSCRIBE_FAILED', { errorCode: 'TOKEN_AMBIGUOUS', matches: customers.length });
      return buildResponse(event, {
        success: false,
        errorCode: 'TOKEN_AMBIGUOUS',
        error: 'Unsubscribe token resolved to multiple customers'
      }, 409);
    }

    const customer = customers[0];
    const notificationEmail = customer.notificationEmail || null;

    if (!customer.notificationsEnabled) {
      structuredLog('CUSTOMER_NOTIFICATION_ALREADY_DISABLED', {
        customerId: customer.id,
        notificationEmail
      });
      return buildResponse(event, {
        success: true,
        customerId: customer.id,
        customerName: customer.name,
        notificationEmail,
        notificationsEnabled: false,
        notificationUnsubscribedAt: customer.notificationUnsubscribedAt || null,
        alreadyUnsubscribed: true,
        error: null,
        errorCode: null
      });
    }

    const unsubscribedAt = new Date().toISOString();
    await disableNotifications(customer.id, unsubscribedAt, tokenHash);

    structuredLog('CUSTOMER_NOTIFICATION_UNSUBSCRIBED', {
      customerId: customer.id,
      notificationEmail,
      notificationUnsubscribedAt: unsubscribedAt
    });

    return buildResponse(event, {
      success: true,
      customerId: customer.id,
      customerName: customer.name,
      notificationEmail,
      notificationsEnabled: false,
      notificationUnsubscribedAt: unsubscribedAt,
      alreadyUnsubscribed: false,
      error: null,
      errorCode: null
    });
  } catch (error) {
    const errorCode = error.name === 'ConditionalCheckFailedException'
      ? 'TOKEN_ALREADY_USED'
      : (error.name || 'UNKNOWN_ERROR');

    structuredLog('CUSTOMER_NOTIFICATION_UNSUBSCRIBE_FAILED', {
      errorCode,
      errorMessage: error.message
    });

    return buildResponse(event, {
      success: false,
      errorCode,
      error: error.message
    }, errorCode === 'TOKEN_ALREADY_USED' ? 409 : 500);
  }
};
