// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useEffect, useState, useCallback } from "react";
import { Amplify, Auth, Hub } from "aws-amplify";
import { Spin, Layout } from "antd";
import awsconfig from "./aws-exports";
import Nav from "./components/Navigation/Nav";
import SignInIdp from "./components/Navigation/SignInIdp";
import logo from "./media/logo-transparent.png";
import "./index.css";
import "./signin-page.css";

const { Content } = Layout;

Amplify.configure(awsconfig);

function Home(props) {
  return (
    <Layout className="signin-page-layout">
      <Content className="signin-page-content">
        <Spin spinning={props.loading} size="large">
          <div className="signin-page-card">
            <img src={logo} alt="CloudiQS" className="signin-page-logo" />
            <h1 className="signin-page-title">CloudiQS MSP</h1>
            <p className="signin-page-tagline">Multi-tenant solution for managed service providers</p>
            <p className="signin-page-desc">
              Temporary elevated access management for AWS IAM Identity Center.
              Sign in with your organization credentials to request or manage access.
            </p>
            <button
              type="button"
              className="signin-page-button"
              onClick={props.onGoToIdp}
            >
              Sign in with AWS
            </button>
            <p className="signin-page-footer">© CloudiQS · Secure access via IAM Identity Center</p>
          </div>
        </Spin>
      </Content>
    </Layout>
  );
}
function App() {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState(null);
  const [cognitoGroups, setcognitoGroups] = useState([]);
  const [userId, setUserId] = useState(null);
  const [groupIds, setGroupIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showIdpStep, setShowIdpStep] = useState(false);

  async function getUser() {
    try {
      const userData = await Auth.currentAuthenticatedUser();
      return userData;
    } catch {
      setLoading(false);
      return console.log("Not signed in");
    }
  }

  const setData = useCallback(() => {
    getUser().then((userData) => {
      setUser(userData);
      const payload = userData.signInUserSession.idToken.payload;
      setcognitoGroups(payload["cognito:groups"]);
      setUserId(payload.userId);
      setGroupIds((payload.groupIds).split(','));
      setGroups((payload.groups).split(','));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    Hub.listen("auth", ({ payload: { event, data } }) => {
      // eslint-disable-next-line default-case
      switch (event) {
        case "signIn":
          console.log("User signed in");
          break;
        // eslint-disable-next-line no-fallthrough
        case "cognitoHostedUI":
          setData();
          break;
        case "signOut":
          console.log("User signed out");
          setLoading(false);
          break;
        case "signIn_failure":
          console.log("User sign in failure");
          break;
        case "cognitoHostedUI_failure":
          console.log("Sign in failure");
          break;
      }
    });

    setData();
  }, [setData]);

  return (
    <div>
      {groups ? (
        <Nav
          user={user}
          groupIds={groupIds}
          userId={userId}
          groups={groups}
          cognitoGroups={cognitoGroups}
        />
      ) : showIdpStep ? (
        <SignInIdp
          loading={loading}
          onBack={() => setShowIdpStep(false)}
        />
      ) : (
        <Home loading={loading} onGoToIdp={() => setShowIdpStep(true)} />
      )}
    </div>
  );
}

export default App;
