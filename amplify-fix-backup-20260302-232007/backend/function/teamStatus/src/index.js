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

const query = /* GraphQL */ `
        mutation UpdateRequests(
            $input: UpdateRequestsInput!
            $condition: ModelRequestsConditionInput
        ) {
            updateRequests(input: $input, condition: $condition) {
            id
            email
            accountId
            accountName
            role
            roleId
            startTime
            duration
            justification
            status
            comment
            username
            approver
            approverId
            approvers
            approver_ids
            revoker
            revokerId
            endTime
            ticketNo
            revokeComment
            createdAt
            updatedAt
            owner
            assignmentPrincipalId
            assignmentPrincipalType
            assignmentRequestId
            activationError
            activationStartedAt
            activationCompletedAt
            revocationCompletedAt
            }
        }
`;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

const updateItem = async (input) => {
    const variables = {
      input,
    }
  
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
    const request = new Request(endpoint, signed);
  
    let statusCode = 200;
    let body;
    let response;
  
    try {
      response = await fetch(request);
      body = await response.json();
      console.log(body);
      if (body.errors) statusCode = 400;
    } catch (error) {
      statusCode = 400;
      body = {
        errors: [
          {
            status: response.status,
            message: error.message,
            stack: error.stack
          }
        ]
      };
    }
  
    return {
      statusCode,
      body: JSON.stringify(body)
    };
  };

export const handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    const id = event.id;
    const approval_required = event.approvalRequired;
    let status = event.status;
    const input = { id };

    if ("statusError" in event || "activationErrorMessage" in event) {
      status = "error";
    } else if ("revoke" in event || "revokeStatus" in event) {
      status = "ended";
    } else if ("grant" in event) {
      status = "in progress";
    } else if (status === "approved") {
      status = "scheduled";
    } else if (!approval_required) {
      status = "scheduled";
    }else if (status === "pending") {
      status = "expired";
    }
    input.status = status;

    if (event.assignmentPrincipalId) {
      input.assignmentPrincipalId = event.assignmentPrincipalId;
    } else if (event.userId) {
      input.assignmentPrincipalId = event.userId;
    }
    if (event.assignmentPrincipalType) {
      input.assignmentPrincipalType = event.assignmentPrincipalType;
    } else if (input.assignmentPrincipalId) {
      input.assignmentPrincipalType = "USER";
    }
    if (event.assignmentRequestId) {
      input.assignmentRequestId = event.assignmentRequestId;
    }
    if (event.activationStartedAt) {
      input.activationStartedAt = event.activationStartedAt;
    }
    if (event.activationCompletedAt) {
      input.activationCompletedAt = event.activationCompletedAt;
    }
    if (event.revocationCompletedAt) {
      input.revocationCompletedAt = event.revocationCompletedAt;
    }
    if (event.activationErrorMessage) {
      input.activationError = event.activationErrorMessage;
    } else if (event.statusError && event.statusError.Cause) {
      input.activationError = event.statusError.Cause;
    } else if (status === "in progress" || status === "ended") {
      input.activationError = null;
    }

    const response = await updateItem(input);
    return response;
};
