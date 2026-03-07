# Customer Auth DU0 - Cognito Customer App Client

Status
- Date: 2026-03-07
- Deploy unit: DU0 - customer auth surface isolation
- Scope: separate customer Cognito app client only
- Out of scope: claims branching, App.js routing, provisioning, Email #2, dashboard data

## Live AWS configuration

- User pool ID: `us-east-1_GyQq313qC`
- User pool name: `team06dbb7fc_userpool_06dbb7fc-main`
- Hosted UI domain: `d13k6ou0ossrku-main.auth.us-east-1.amazoncognito.com`
- Customer app client name: `cloudiqs-customer-web`
- Customer app client ID: `57n8njdqivsd80pbn27e5s42ks`

## Locked DU0 settings

- Same user pool as workforce auth
- Separate customer app client
- Hosted UI enabled
- Supported identity providers:
  - `COGNITO` only
- Allowed OAuth flow:
  - `code`
- Allowed OAuth scopes:
  - `openid`
  - `email`
  - `profile`
- Callback URLs:
  - `https://main.d13k6ou0ossrku.amplifyapp.com/customer`
  - `https://main.d13k6ou0ossrku.amplifyapp.com/customer-setup`
- Logout URLs:
  - `https://main.d13k6ou0ossrku.amplifyapp.com/customer`

## Proof artifact

Customer Hosted UI authorize URL template:

```text
https://d13k6ou0ossrku-main.auth.us-east-1.amazoncognito.com/oauth2/authorize?identity_provider=COGNITO&redirect_uri=https%3A%2F%2Fmain.d13k6ou0ossrku.amplifyapp.com%2Fcustomer&response_type=code&client_id=57n8njdqivsd80pbn27e5s42ks&scope=openid+email+profile
```

Expected DU0 behavior:
- customer auth uses this client, not the workforce web client
- Hosted UI presents Cognito-native login only
- callback routes are customer-only routes

## Source-of-truth note

This DU0 change was applied live in Cognito first.
It still needs later IaC/auth config reconciliation before it can be considered fully self-healing from repo state alone.
