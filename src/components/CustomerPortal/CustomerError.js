import React from "react";
import { Alert, Button, Layout } from "antd";
import { Auth } from "aws-amplify";
import logo from "../../media/logo-transparent.png";

const { Content } = Layout;

async function signOutCustomer() {
  await Auth.signOut();
  window.location.href = "/";
}

function CustomerError({ authError, customerId }) {
  return (
    <Layout className="signin-page-layout">
      <Content className="signin-page-content">
        <div className="signin-page-card">
          <img src={logo} alt="CloudiQS" className="signin-page-logo" />
          <h1 className="signin-page-title">Customer access not ready</h1>
          <p className="signin-page-desc">
            Your account is not linked to a usable customer tenant yet. Contact CloudiQS support if this should already be active.
          </p>
          <Alert
            type="error"
            showIcon
            message="Customer portal access failed"
            description={authError || "CUSTOMER_ID_MISSING"}
            style={{ marginBottom: 16, textAlign: "left" }}
          />
          {customerId ? (
            <p className="signin-page-desc"><strong>customerId:</strong> {customerId}</p>
          ) : null}
          <Button type="primary" onClick={signOutCustomer}>
            Sign out
          </Button>
        </div>
      </Content>
    </Layout>
  );
}

export default CustomerError;
