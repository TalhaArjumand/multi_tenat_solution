// CloudiQS MSP – Branded intermediary: "Sign in with your corporate ID" + IDC
import React from "react";
import { Auth } from "aws-amplify";
import { Layout } from "antd";
import logo from "../../media/logo-transparent.png";
import "../../signin-page.css";

const { Content } = Layout;

function SignInIdp({ loading, onBack }) {
  const handleIdcSignIn = () => {
    Auth.federatedSignIn();
  };

  return (
    <Layout className="signin-page-layout signin-page-layout--idp">
      <Content className="signin-page-content">
        <div className="signin-page-card signin-page-card--idp">
          <img src={logo} alt="CloudiQS" className="signin-page-logo signin-page-logo--idp" />
          <h1 className="signin-page-title">CloudiQS MSP</h1>
          <p className="signin-page-tagline signin-page-tagline--idp">
            Sign in with your corporate ID
          </p>
          <p className="signin-page-desc signin-page-desc--idp">
            Use your organization’s IAM Identity Center credentials to continue.
          </p>
          <button
            type="button"
            className="signin-page-button signin-page-button--idc"
            onClick={handleIdcSignIn}
            disabled={loading}
          >
            IDC
          </button>
          <button
            type="button"
            className="signin-page-back"
            onClick={onBack}
            aria-label="Back to sign in options"
          >
            ← Back
          </button>
          <p className="signin-page-footer">© CloudiQS · IAM Identity Center</p>
        </div>
      </Content>
    </Layout>
  );
}

export default SignInIdp;
