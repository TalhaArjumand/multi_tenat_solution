/* Amplify Params - DO NOT EDIT
	API_TEAM_GRAPHQLAPIENDPOINTOUTPUT
	API_TEAM_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

const listCustomersByTokenQuery = /* GraphQL */ `
  query ListCustomersByInvitationToken($invitationToken: String!) {
    listCustomers(filter: { invitationToken: { eq: $invitationToken } }) {
      items {
        id
        name
        description
        adminEmail
        adminName
        permissionSet
        roleStatus
        invitationToken
        invitationSentAt
        invitationExpiresAt
        approvedAt
        cloudFormationTemplate
      }
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

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Handle AppSync @function, API Gateway, and direct invocation
    let invitationToken;
    
    if (event.arguments) {
      // AppSync @function invocation
      invitationToken = event.arguments.invitationToken;
    } else if (event.body) {
      // API Gateway
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      invitationToken = body.invitationToken;
    } else {
      // Direct invocation
      invitationToken = event.invitationToken;
    }
    
    if (!invitationToken) {
      const errorData = { error: 'Missing required field: invitationToken' };
      if (event.arguments) {
        return errorData;
      }
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(errorData)
      };
    }
    
    // Query customer by invitation token
    const result = await graphqlRequest(listCustomersByTokenQuery, { invitationToken });
    
    if (!result.listCustomers || result.listCustomers.items.length === 0) {
      const errorData = { error: 'Invalid or expired invitation token' };
      if (event.arguments) {
        return errorData;
      }
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(errorData)
      };
    }
    
    const customer = result.listCustomers.items[0];
    
    // Check if invitation has expired
    if (customer.invitationExpiresAt) {
      const expiryDate = new Date(customer.invitationExpiresAt);
      const now = new Date();
      
      if (now > expiryDate) {
        const errorData = { error: 'Invitation has expired' };
        if (event.arguments) {
          return errorData;
        }
        return {
          statusCode: 410,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'Invitation has expired',
            expiresAt: customer.invitationExpiresAt
          })
        };
      }
    }
    
    // Check if already rejected
    if (customer.roleStatus === 'rejected') {
      const errorData = { error: 'Invitation has been rejected', roleStatus: customer.roleStatus };
      if (event.arguments) {
        return errorData;
      }
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(errorData)
      };
    }
    
    // Return customer details (exclude sensitive fields)
    const responseData = {
      id: customer.id,
      name: customer.name,
      description: customer.description,
      adminEmail: customer.adminEmail,
      adminName: customer.adminName,
      permissionSet: customer.permissionSet,
      roleStatus: customer.roleStatus,
      invitationSentAt: customer.invitationSentAt,
      invitationExpiresAt: customer.invitationExpiresAt,
      approvedAt: customer.approvedAt,
      cloudFormationTemplate: customer.cloudFormationTemplate
    };
    
    if (event.arguments) {
      return responseData;
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    console.error('Error getting invitation details:', error);
    const errorData = { error: 'Internal server error' };
    if (event.arguments) {
      return errorData;
    }
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
