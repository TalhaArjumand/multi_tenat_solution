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
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

const stsClient = new STSClient({ region: REGION });

const updateCustomerMutation = /* GraphQL */ `
  mutation UpdateCustomers(
    $input: UpdateCustomersInput!
    $condition: ModelCustomersConditionInput
  ) {
    updateCustomers(input: $input, condition: $condition) {
      id
      name
      roleStatus
      roleArn
      roleEstablishedAt
      lastRoleVerification
      roleVerificationError
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

async function verifyRoleAccess(roleArn, externalId, customerId) {
  try {
    console.log(`Attempting to assume role: ${roleArn} with externalId: ${externalId}`);
    
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `CIQ-Verify-${customerId.substring(0, 8)}-${Date.now()}`,
      ExternalId: externalId,
      DurationSeconds: 900 // 15 minutes (minimum allowed)
    });
    
    const response = await stsClient.send(command);
    
    console.log('Successfully assumed role:', {
      accountId: response.AssumedRoleUser.Arn.split(':')[4],
      roleId: response.AssumedRoleUser.AssumedRoleId
    });
    
    return {
      success: true,
      accountId: response.AssumedRoleUser.Arn.split(':')[4],
      credentials: response.Credentials
    };
  } catch (error) {
    console.error('Failed to assume role:', error);
    return {
      success: false,
      error: error.message,
      errorCode: error.name
    };
  }
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Handle both AppSync @function and direct invocation
    const args = event.arguments || event;
    const { customerId, roleArn, externalId } = args;
    
    // Validate required fields
    if (!customerId || !roleArn || !externalId) {
      const errorResponse = { 
        error: 'Missing required fields',
        required: ['customerId', 'roleArn', 'externalId']
      };
      if (event.arguments) {
        return { success: false, error: errorResponse.error };
      }
      return { statusCode: 400, body: JSON.stringify(errorResponse) };
    }
    
    // Validate roleArn format
    if (!roleArn.match(/^arn:aws:iam::\d{12}:role\/.+$/)) {
      const errorResponse = { 
        error: 'Invalid roleArn format',
        expected: 'arn:aws:iam::ACCOUNT-ID:role/ROLE-NAME'
      };
      if (event.arguments) {
        return { success: false, error: errorResponse.error };
      }
      return { statusCode: 400, body: JSON.stringify(errorResponse) };
    }
    
    // Attempt to verify the role
    const verificationResult = await verifyRoleAccess(roleArn, externalId, customerId);
    
    const now = new Date().toISOString();
    
    if (verificationResult.success) {
      // Update customer with established status
      const updateInput = {
        id: customerId,
        roleStatus: 'established',
        roleArn: roleArn,
        roleEstablishedAt: now,
        lastRoleVerification: now,
        roleVerificationError: null
      };
      
      await graphqlRequest(updateCustomerMutation, { input: updateInput });
      
      console.log(`Customer ${customerId} role verified successfully`);
      
      const result = {
        success: true,
        customerId,
        roleStatus: 'established',
        accountId: verificationResult.accountId,
        verifiedAt: now
      };
      
      if (event.arguments) return result;
      return { statusCode: 200, body: JSON.stringify(result) };
    } else {
      // Update customer with verification_failed status
      const updateInput = {
        id: customerId,
        roleStatus: 'verification_failed',
        lastRoleVerification: now,
        roleVerificationError: `${verificationResult.errorCode}: ${verificationResult.error}`
      };
      
      await graphqlRequest(updateCustomerMutation, { input: updateInput });
      
      console.log(`Customer ${customerId} role verification failed`);
      
      const result = {
        success: false,
        customerId,
        roleStatus: 'verification_failed',
        error: verificationResult.error,
        errorCode: verificationResult.errorCode,
        verifiedAt: now
      };
      
      if (event.arguments) return result;
      return { statusCode: 200, body: JSON.stringify(result) };
    }
  } catch (error) {
    console.error('Error in verification handler:', error);
    
    if (event.arguments) {
      return { success: false, customerId: (event.arguments || event).customerId, error: error.message };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
