import React, { useState } from "react";
import Button from "@awsui/components-react/button";
import Modal from "@awsui/components-react/modal";
import SpaceBetween from "@awsui/components-react/space-between";
import Box from "@awsui/components-react/box";
import CopyToClipboard from "@awsui/components-react/copy-to-clipboard";
import { API, graphqlOperation } from "aws-amplify";

// GraphQL query to get multi-tenant credentials
const getMultiTenantCredentials = /* GraphQL */ `
  query GetMultiTenantCredentials($requestId: String!, $accessType: String!) {
    getMultiTenantCredentials(requestId: $requestId, accessType: $accessType) {
      consoleUrl
      accessKeyId
      secretAccessKey
      sessionToken
      expiration
      error
    }
  }
`;

function ActiveAccessActions({ request, addNotification }) {
  const [cliVisible, setCliVisible] = useState(false);
  const [cliCredentials, setCliCredentials] = useState(null);
  const [loading, setLoading] = useState(false);

  const isMultiTenant = request.roleId?.startsWith("mt-");

  if (!isMultiTenant) {
    // For SSO requests, show the existing SSO login link
    return null; // The existing SSO flow handles this
  }

  const handleConsoleAccess = async () => {
    setLoading(true);
    try {
      const result = await API.graphql(
        graphqlOperation(getMultiTenantCredentials, {
          requestId: request.id,
          accessType: "console",
        })
      );
      const data = result.data.getMultiTenantCredentials;
      if (data.consoleUrl) {
        window.open(data.consoleUrl, "_blank");
      } else {
        addNotification([{
          type: "error",
          content: data.error || "Failed to generate console URL",
          dismissible: true,
          onDismiss: () => addNotification([]),
        }]);
      }
    } catch (error) {
      addNotification([{
        type: "error",
        content: `Console access failed: ${error.message}`,
        dismissible: true,
        onDismiss: () => addNotification([]),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCliAccess = async () => {
    setLoading(true);
    try {
      const result = await API.graphql(
        graphqlOperation(getMultiTenantCredentials, {
          requestId: request.id,
          accessType: "cli",
        })
      );
      const data = result.data.getMultiTenantCredentials;
      if (data.accessKeyId) {
        setCliCredentials(data);
        setCliVisible(true);
      } else {
        addNotification([{
          type: "error",
          content: data.error || "Failed to get CLI credentials",
          dismissible: true,
          onDismiss: () => addNotification([]),
        }]);
      }
    } catch (error) {
      addNotification([{
        type: "error",
        content: `CLI access failed: ${error.message}`,
        dismissible: true,
        onDismiss: () => addNotification([]),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const envVarsText = cliCredentials
    ? `export AWS_ACCESS_KEY_ID="${cliCredentials.accessKeyId}"
export AWS_SECRET_ACCESS_KEY="${cliCredentials.secretAccessKey}"
export AWS_SESSION_TOKEN="${cliCredentials.sessionToken}"`
    : "";

  const credentialsFileText = cliCredentials
    ? `[${request.accountName || "customer-profile"}]
aws_access_key_id = ${cliCredentials.accessKeyId}
aws_secret_access_key = ${cliCredentials.secretAccessKey}
aws_session_token = ${cliCredentials.sessionToken}`
    : "";

  return (
    <>
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          variant="primary"
          onClick={handleConsoleAccess}
          loading={loading}
          iconName="external"
        >
          Access Console
        </Button>
        <Button
          variant="primary"
          onClick={handleCliAccess}
          loading={loading}
          iconName="download"
        >
          CLI Credentials
        </Button>
      </SpaceBetween>

      <Modal
        visible={cliVisible}
        onDismiss={() => setCliVisible(false)}
        header="CLI Credentials"
        footer={
          <Box float="right">
            <Button onClick={() => setCliVisible(false)}>Close</Button>
          </Box>
        }
        size="large"
      >
        <SpaceBetween size="l">
          <Box>
            <h4>Environment Variables (Linux/Mac)</h4>
            <Box variant="code">
              <pre>{envVarsText}</pre>
            </Box>
            <CopyToClipboard
              copyButtonText="Copy"
              copySuccessText="Copied!"
              textToCopy={envVarsText}
            />
          </Box>
          <Box>
            <h4>AWS Credentials File (~/.aws/credentials)</h4>
            <Box variant="code">
              <pre>{credentialsFileText}</pre>
            </Box>
            <CopyToClipboard
              copyButtonText="Copy"
              copySuccessText="Copied!"
              textToCopy={credentialsFileText}
            />
          </Box>
          <Box>
            <p>
              <strong>Expires:</strong> {cliCredentials?.expiration}
            </p>
            <p>
              <strong>Account:</strong> {request.accountId} ({request.accountName})
            </p>
            <p>
              <strong>Role:</strong> {request.role}
            </p>
          </Box>
        </SpaceBetween>
      </Modal>
    </>
  );
}

export default ActiveAccessActions;