// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useEffect, useState, useCallback } from "react";
import { Auth, Hub } from "aws-amplify";
import { Spin, Layout } from "antd";
import { BrowserRouter, Switch, Route, Redirect } from "react-router-dom";
import Nav from "./components/Navigation/Nav";
import SignInIdp from "./components/Navigation/SignInIdp";
import CustomerApprovalPage from "./components/CustomerApproval/CustomerApprovalPage";
import CustomerDashboard from "./components/CustomerPortal/CustomerDashboard";
import CustomerError from "./components/CustomerPortal/CustomerError";
import CustomerPortalPaused from "./components/CustomerPortal/CustomerPortalPaused";
import NotificationUnsubscribePage from "./components/Notifications/NotificationUnsubscribePage";
import { CUSTOMER_PORTAL_ENABLED } from "./config/features";
import logo from "./media/logo-transparent.png";
import "./index.css";
import "./signin-page.css";

const { Content } = Layout;

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
  const [customerId, setCustomerId] = useState(null);
  const [customerAuthError, setCustomerAuthError] = useState(null);
  const [userType, setUserType] = useState(null);

  async function getUser() {
    try {
      const userData = await Auth.currentAuthenticatedUser();
      return userData;
    } catch {
      setUser(null);
      setGroups(null);
      setcognitoGroups([]);
      setUserId(null);
      setGroupIds(null);
      setCustomerId(null);
      setCustomerAuthError(null);
      setUserType(null);
      setLoading(false);
      return console.log("Not signed in");
    }
  }

  const setData = useCallback(() => {
    getUser().then((userData) => {
      if (!userData) {
        return;
      }
      setUser(userData);
      const payload = userData.signInUserSession.idToken.payload;
      const isCustomer = payload["custom:userType"] === "customer";
      const resolvedCustomerId = payload["custom:customerId"] || null;
      const authError = payload["custom:authError"] || null;
      setUserType(payload["custom:userType"] || null);
      setCustomerId(resolvedCustomerId);
      setCustomerAuthError(authError);

      if (isCustomer) {
        setcognitoGroups(payload["cognito:groups"] || []);
        setUserId(null);
        setGroupIds(null);
        setGroups(null);
        setLoading(false);
        return;
      }

      setcognitoGroups(payload["cognito:groups"] || []);
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

  const pathname = window.location.pathname;
  const isCustomerRoute = pathname === "/customer" || pathname === "/customer-setup" || pathname.startsWith("/customer/");
  const isCustomer = userType === "customer";

  return (
    <BrowserRouter>
      <Switch>
        <Route path="/customer-approval" exact component={CustomerApprovalPage} />
        <Route path="/notifications/unsubscribe" exact component={NotificationUnsubscribePage} />
        <Route path="*">
          <div>
            {!CUSTOMER_PORTAL_ENABLED && isCustomerRoute ? (
              <CustomerPortalPaused />
            ) : loading ? (
              <Home loading={loading} onGoToIdp={() => setShowIdpStep(true)} />
            ) : isCustomer ? (
              !customerId ? (
                pathname === "/customer/error" ? (
                  <CustomerError authError={customerAuthError} customerId={customerId} />
                ) : (
                  <Redirect to="/customer/error" />
                )
              ) : !isCustomerRoute ? (
                <Redirect to="/customer" />
              ) : (
                <Switch>
                  <Route path="/customer/error">
                    <CustomerError authError={customerAuthError} customerId={customerId} />
                  </Route>
                  <Route path="/customer-setup">
                    <CustomerDashboard customerId={customerId} mode="setup" />
                  </Route>
                  <Route path="/customer">
                    <CustomerDashboard customerId={customerId} />
                  </Route>
                  <Redirect to="/customer" />
                </Switch>
              )
            ) : isCustomerRoute ? (
              <Redirect to="/" />
            ) : groups ? (
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
        </Route>
      </Switch>
    </BrowserRouter>
  );
}

export default App;
