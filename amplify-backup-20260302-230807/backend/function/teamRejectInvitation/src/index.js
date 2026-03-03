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

const updateCustomerMutation = /* GraphQL */ `
  mutation UpdateCustomers(
    $input: UpdateCustomersInput!
    $condition: ModelCustomersConditionInput
  ) {
    updateCustomers(input: $input, condition: $condition) {
      id
      name
      roleStatus
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
    let invitationToken, reason;
    
    if (event.arguments) {
      // AppSync @function invocation
      invitationToken = event.arguments.invitationToken;
      reason = event.arguments.reason;
    } else if (event.body) {
      // API Gateway
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      invitationToken = body.invitationToken;
      reason = body.reason;
    } else {
      // Direct invocation
      invitationToken = event.invitationToken;
      reason = event.reason;
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
    
    // Find customer by invitation token
    const listQuery = /* GraphQL */ `
      query ListCustomersByInvitationToken($invitationToken: String!) {
        listCustomers(filter: { invitationToken: { eq: $invitationToken } }) {
          items {
            id
            name
            roleStatus
            invitationExpiresAt
          }
        }
      }
    `;
    
    const listResult = await graphqlRequest(listQuery, { invitationToken });
    
    if (!listResult.listCustomers || listResult.listCustomers.items.length === 0) {
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
    
    const customer = listResult.listCustomers.items[0];
    
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
      const responseData = { success: true, id: customer.id, name: customer.name, roleStatus: 'rejected' };
      if (event.arguments) {
        return responseData;
      }
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: true,
          message: 'Invitation was already rejected'
        })
      };
    }
    
    // Update customer status to rejected
    const updateInput = {
      id: customer.id,
      roleStatus: 'rejected',
      roleVerificationError: reason || 'Customer rejected the invitation'
    };
    
    await graphqlRequest(updateCustomerMutation, { input: updateInput });
    
    console.log(`Customer ${customer.id} rejected invitation`);
    
    const responseData = {
      success: true,
      id: customer.id,
      name: customer.name,
      roleStatus: 'rejected'
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
      body: JSON.stringify({
        ...responseData,
        customerId: customer.id,
        customerName: customer.name,
        message: 'Invitation has been rejected successfully'
      })
    };
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    if (event.arguments) {
      return { error: 'Internal server error' };
    }
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
