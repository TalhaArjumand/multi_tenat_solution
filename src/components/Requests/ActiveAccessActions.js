import React, { useState } from "react";
import {
  Button,
  SpaceBetween,
  Box,
  Modal,
  Spinner,
  Alert,
} from "@awsui/components-react";
import { API, graphqlOperation } from "aws-amplify";
import { getMultiTenantCredentials } from "../../graphql/queries";

function ActiveAccessActions({ request }) {
  const [loading, setLoading] = useState(false);
  const [cliModalVisible, setCliModalVisible] = useState(false);
  const [cliCredentials, setCliCredentials] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState("");

  // Only render for multi-tenant requests that are active
  if (
    !request ||
    !request.roleId ||
    !request.roleId.startsWith("mt-") ||
    request.status !== "in progress"
  ) {
    return null;
  }

  async function handleConsoleAccess() {
    setLoading(true);
    setError(null);
    try {
      const result = await API.graphql(
        graphqlOperation(getMultiTenantCredentials, {
          requestId: request.id,
          accessType: "console",
        })
      );
      const data = result.data.getMultiTenantCredentials;
      if (data.error) {
        setError(data.error);
      } else if (data.consoleUrl) {
        window.open(data.consoleUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err.message || "Failed to get console access");
    } finally {
      setLoading(false);
    }
  }

  async function handleCliAccess() {
    setLoading(true);
    setError(null);
    try {
      const result = await API.graphql(
        graphqlOperation(getMultiTenantCredentials, {
          requestId: request.id,
          accessType: "cli",
        })
      );
      const data = result.data.getMultiTenantCredentials;
      if (data.error) {
        setError(data.error);
      } else {
        setCliCredentials(data);
        setCliModalVisible(true);
      }
    } catch (err) {
      setError(err.message || "Failed to get CLI credentials");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  function getEnvVarsFormat() {
    if (!cliCredentials) return "";
    return [
      `export AWS_ACCESS_KEY_ID=${cliCredentials.accessKeyId}`,
      `export AWS_SECRET_ACCESS_KEY=${cliCredentials.secretAccessKey}`,
      `export AWS_SESSION_TOKEN=${cliCredentials.sessionToken}`,
    ].join("\n");
  }

  function getCredentialsFileFormat() {
    if (!cliCredentials) return "";
    const profileName = `cloudiq-${request.accountId}-${request.roleId ? request.roleId.replace('mt-', '') : 'session'}`;
    return [
      `[${profileName}]`,
      `aws_access_key_id = ${cliCredentials.accessKeyId}`,
      `aws_secret_access_key = ${cliCredentials.secretAccessKey}`,
      `aws_session_token = ${cliCredentials.sessionToken}`,
    ].join("\n");
  }

  return (
    <>
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          variant="primary"
          iconName="external"
          onClick={handleConsoleAccess}
          loading={loading}
        >
          Access Console
        </Button>
        <Button
          iconName="download"
          onClick={handleCliAccess}
          loading={loading}
        >
          CLI Credentials
        </Button>
      </SpaceBetween>

      {error && (
        <Box margin={{ top: "s" }}>
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {loading && <Spinner size="normal" />}

      <Modal
        visible={cliModalVisible}
        onDismiss={() => setCliModalVisible(false)}
        closeAriaLabel="Close"
        size="large"
        header="CLI Credentials"
        footer={
          <Box float="right">
            <Button onClick={() => setCliModalVisible(false)}>Close</Button>
          </Box>
        }
      >
        {cliCredentials && (
          <SpaceBetween direction="vertical" size="l">
            <Box>
              <Box variant="h4">Expiration</Box>
              <Box variant="p">{cliCredentials.expiration}</Box>
            </Box>

            <Box>
              <SpaceBetween direction="horizontal" size="xs">
                <Box variant="h4">Environment Variables</Box>
                <Button
                  variant="inline-icon"
                  iconName="copy"
                  onClick={() =>
                    copyToClipboard(getEnvVarsFormat(), "env")
                  }
                >
                  {copied === "env" ? "Copied!" : "Copy"}
                </Button>
              </SpaceBetween>
              <Box variant="code">
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {getEnvVarsFormat()}
                </pre>
              </Box>
            </Box>

            <Box>
              <SpaceBetween direction="horizontal" size="xs">
                <Box variant="h4">AWS Credentials File</Box>
                <Button
                  variant="inline-icon"
                  iconName="copy"
                  onClick={() =>
                    copyToClipboard(getCredentialsFileFormat(), "creds")
                  }
                >
                  {copied === "creds" ? "Copied!" : "Copy"}
                </Button>
              </SpaceBetween>
              <Box variant="code">
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {getCredentialsFileFormat()}
                </pre>
              </Box>
            </Box>
          </SpaceBetween>
        )}
      </Modal>
    </>
  );
}

export default ActiveAccessActions;
