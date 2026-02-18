/* Amplify Params - DO NOT EDIT
	API_TEAM_GRAPHQLAPIENDPOINTOUTPUT
	API_TEAM_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
	FUNCTION_TEAMGENERATECLOUDFORMATION_NAME
Amplify Params - DO NOT EDIT */

import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;
const GENERATE_CFN_FUNCTION = process.env.FUNCTION_TEAMGENERATECLOUDFORMATION_NAME;

const lambdaClient = new LambdaClient({ region: REGION });

const getCustomerQuery = /* GraphQL */ `
  query GetCustomers($id: ID!) {
    getCustomers(id: $id) {
      id
      name
      description
      adminEmail
      adminName
      permissionSet
      roleStatus
      externalId
      invitationToken
      invitationExpiresAt
      cloudFormationTemplate
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
      name
      roleStatus
      approvedAt
      cloudFormationTemplate
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

async function generateCloudFormation(customer) {
  const payload = {
    customerId: customer.id,
    customerName: customer.name,
    permissionSet: customer.permissionSet,
    externalId: customer.externalId
  };
  
  const command = new InvokeCommand({
    FunctionName: GENERATE_CFN_FUNCTION,
    Payload: JSON.stringify(payload)
  });
  
  const response = await lambdaClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  
  if (result.statusCode !== 200) {
    throw new Error(`CloudFormation generation failed: ${result.body}`);
  }
  
  const body = JSON.parse(result.body);
  return body.cloudFormationTemplate;
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Handle AppSync @function, API Gateway, and direct invocation
    let invitationToken, roleArn;
    
    if (event.arguments) {
      // AppSync @function invocation
      invitationToken = event.arguments.invitationToken;
      roleArn = event.arguments.roleArn;
    } else if (event.body) {
      // API Gateway
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      invitationToken = body.invitationToken;
      roleArn = body.roleArn;
    } else {
      // Direct invocation
      invitationToken = event.invitationToken;
      roleArn = event.roleArn;
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
            permissionSet
            roleStatus
            externalId
            invitationExpiresAt
            cloudFormationTemplate
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
    
    // Check if already approved or rejected
    if (customer.roleStatus === 'rejected') {
      const errorData = { error: 'Invitation has been rejected' };
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
    
    // Generate CloudFormation template if not already generated
    let cfnTemplate = customer.cloudFormationTemplate;
    if (!cfnTemplate) {
      cfnTemplate = await generateCloudFormation(customer);
    }
    
    // Update customer status to approved
    const approvedAt = new Date().toISOString();
    const updateInput = {
      id: customer.id,
      roleStatus: 'approved',
      approvedAt,
      cloudFormationTemplate: cfnTemplate
    };
    
    if (roleArn) {
      updateInput.roleArn = roleArn;
    }
    
    await graphqlRequest(updateCustomerMutation, { input: updateInput });
    
    console.log(`Customer ${customer.id} approved successfully`);
    
    const responseData = {
      success: true,
      id: customer.id,
      name: customer.name,
      roleStatus: 'approved',
      approvedAt,
      cloudFormationTemplate: cfnTemplate
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
        nextSteps: [
          'Download the CloudFormation template',
          'Log in to your AWS account',
          'Navigate to CloudFormation console',
          'Create a new stack with the downloaded template',
          'Wait for stack creation to complete',
          'The role will be automatically verified'
        ]
      })
    };
  } catch (error) {
    console.error('Error approving invitation:', error);
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
