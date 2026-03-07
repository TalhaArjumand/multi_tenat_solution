import React from "react";
import { Button, Layout } from "antd";
import { Auth } from "aws-amplify";
import logo from "../../media/logo-transparent.png";

const { Content } = Layout;

async function signOutCustomer() {
  await Auth.signOut();
  window.location.href = "/";
}

function CustomerDashboard({ customerId, mode }) {
  const isSetupMode = mode === "setup";

  return (
    <Layout className="signin-page-layout">
      <Content className="signin-page-content">
        <div className="signin-page-card">
          <img src={logo} alt="CloudiQS" className="signin-page-logo" />
          <h1 className="signin-page-title">
            {isSetupMode ? "Customer Setup" : "Customer Portal (v1)"}
          </h1>
          <p className="signin-page-tagline">
            {isSetupMode ? "Setup flow placeholder" : "Customer-scoped access surface"}
          </p>
          <p className="signin-page-desc">
            {isSetupMode
              ? "The password setup flow will be added in DU2. Your customer route isolation is already active."
              : "Customer routing is active. Dashboard data and provisioning will be added in later deploy units."}
          </p>
          <p className="signin-page-desc"><strong>customerId:</strong> {customerId}</p>
          <Button type="primary" onClick={signOutCustomer}>
            Sign out
          </Button>
        </div>
      </Content>
    </Layout>
  );
}

export default CustomerDashboard;
