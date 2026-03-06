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
            statusErrorCode
            statusErrorMessage
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
            }
        }
`;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

const parseStatusError = (statusError) => {
    if (!statusError) {
      return {};
    }

    let code = statusError.Error || "ERROR";
    let message = statusError.Cause || statusError.Error || "Request failed";

    if (typeof statusError.Cause === "string") {
      try {
        const parsedCause = JSON.parse(statusError.Cause);
        if (parsedCause?.errorMessage) {
          message = parsedCause.errorMessage;
          const prefixedCode = parsedCause.errorMessage.match(/^([A-Z0-9_]+)(?::|$)/);
          if (prefixedCode) {
            code = prefixedCode[1];
          } else if (parsedCause.errorType && /^[A-Z0-9_]+$/.test(parsedCause.errorType)) {
            code = parsedCause.errorType;
          }
        }
      } catch (error) {
        const prefixedCode = statusError.Cause.match(/^([A-Z0-9_]+)(?::|$)/);
        if (prefixedCode) {
          code = prefixedCode[1];
          message = statusError.Cause;
        }
      }
    }

    return {
      statusErrorCode: String(code || "ERROR").slice(0, 120),
      statusErrorMessage: String(message || "Request failed").slice(0, 500),
    };
  };

const updateItem = async (id, status, statusError) => {
    const variables = {
      input: {
        id: id,
        status: status
      } 
    }

    if (statusError) {
      Object.assign(variables.input, parseStatusError(statusError));
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

    if ('statusError' in event) {
      status = "error";
    } else if ("revoke" in event) {
      status = "ended";
    } else if ("grant" in event) {
      status = "in progress";
    } else if ("isMultiTenant" in event && event.isMultiTenant && "multiTenantCredentials" in event) {
      // Multi-tenant grant succeeded — the grant key might be named differently
      status = "in progress";
    } else if (status === "approved") {
      status = "scheduled";
    } else if (!approval_required) {
      status = "scheduled";
    }else if (status === "pending") {
      status = "expired";
    }
    const response = await updateItem(id, status, event.statusError);
    return response;
};
