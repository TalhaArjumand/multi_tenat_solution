import React, { useEffect, useMemo, useState } from "react";
import { API } from "aws-amplify";
import { Alert, Button, Spin } from "antd";
import { useLocation } from "react-router-dom";
import logo from "../../media/logo-transparent.png";
import "../../signin-page.css";

const unsubscribeCustomerNotificationsMutation = /* GraphQL */ `
  mutation UnsubscribeCustomerNotifications($unsubscribeToken: String!) {
    unsubscribeCustomerNotifications(unsubscribeToken: $unsubscribeToken) {
      success
      customerId
      customerName
      notificationEmail
      notificationsEnabled
      notificationUnsubscribedAt
      alreadyUnsubscribed
      error
      errorCode
    }
  }
`;

function getUnsubscribeToken(search) {
  const params = new URLSearchParams(search);
  return params.get("token");
}

export default function NotificationUnsubscribePage() {
  const location = useLocation();
  const unsubscribeToken = useMemo(() => getUnsubscribeToken(location.search), [location.search]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function unsubscribe() {
      if (!unsubscribeToken) {
        setError({
          errorCode: "MISSING_UNSUBSCRIBE_TOKEN",
          error: "Missing unsubscribe token."
        });
        setLoading(false);
        return;
      }

      try {
        const response = await API.graphql({
          query: unsubscribeCustomerNotificationsMutation,
          variables: { unsubscribeToken },
          authMode: "AWS_IAM"
        });

        const payload = response?.data?.unsubscribeCustomerNotifications;
        if (!payload?.success) {
          setError({
            errorCode: payload?.errorCode || "UNSUBSCRIBE_FAILED",
            error: payload?.error || "Unable to unsubscribe notifications."
          });
        } else {
          setResult(payload);
        }
      } catch (invokeError) {
        const graphqlError = invokeError?.errors?.[0];
        setError({
          errorCode: graphqlError?.errorType || "UNSUBSCRIBE_FAILED",
          error: graphqlError?.message || invokeError.message || "Unable to unsubscribe notifications."
        });
      } finally {
        setLoading(false);
      }
    }

    unsubscribe();
  }, [unsubscribeToken]);

  const title = result?.alreadyUnsubscribed
    ? "Notifications already disabled"
    : result?.success
      ? "Notifications disabled"
      : "Unable to disable notifications";

  return (
    <div className="signin-page-layout">
      <div className="signin-page-content">
        <div className="signin-page-card" style={{ maxWidth: 640 }}>
          <img src={logo} alt="CloudiQS" className="signin-page-logo" />
          <h1 className="signin-page-title">CloudiQS MSP</h1>
          <h2 style={{ marginTop: 0 }}>{title}</h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <Spin size="large" />
            </div>
          ) : error ? (
            <Alert
              type="error"
              showIcon
              message={error.errorCode || "UNSUBSCRIBE_FAILED"}
              description={error.error}
            />
          ) : (
            <>
              <Alert
                type="success"
                showIcon
                message={result?.alreadyUnsubscribed ? "You were already unsubscribed." : "You will no longer receive CloudiQS customer access notifications."}
                description={
                  <div>
                    <div><strong>Customer:</strong> {result?.customerName || result?.customerId}</div>
                    <div><strong>Email:</strong> {result?.notificationEmail || "Not available"}</div>
                    <div><strong>Unsubscribed at:</strong> {result?.notificationUnsubscribedAt || "Recorded"}</div>
                  </div>
                }
              />
              <p style={{ marginTop: "1rem", color: "#555" }}>
                If you need notifications again later, your CloudiQS administrator can re-enable them for this customer.
              </p>
            </>
          )}

          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <Button type="primary" onClick={() => { window.location.href = "/"; }}>
              Return to CloudiQS
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
