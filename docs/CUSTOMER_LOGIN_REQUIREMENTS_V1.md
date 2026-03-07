# Customer Login Requirements v1

Status
- Version: v1
- Purpose: implementation-ready spec for customer portal login, Email #2 automation, and tenant-scoped dashboard access
- Non-goals: does not redesign JIT access mechanics; does not implement customer SSO federation (v2)

## 1. Problem statement

After a customer becomes `roleStatus = established`, they must be able to:
- securely access the CloudIQS customer portal
- authenticate without receiving passwords by email
- be tenant-bound so they only see their own customer dashboard and data

Current onboarding already covers:
- customer creation
- invitation/review email
- customer approval
- CloudFormation template generation
- customer stack deployment
- role verification to `established`

The missing v1 capability is:
- automated Email #2 on `established`
- secure customer portal login
- tenant-scoped customer dashboard entry

## 2. Core invariants (Model B)

### I1. External customer model
Customer accounts are external. Portal access must not depend on AWS Organizations membership or MSP org inventory.

### I2. Strong tenant binding
Every authenticated customer portal session maps to exactly one `customerId`.
Tenant binding is enforced server-side using identity claims, not UI state.

### I3. No passwords in email
No temporary password, no reusable credential, and no plaintext password is ever sent by email.
Only a time-bounded invite/setup flow is allowed.

### I4. Idempotent provisioning
Provisioning and emailing must be safe to run multiple times without duplicate users, duplicate invites, or inconsistent state.

### I5. Observable and debuggable
Each provisioning step emits structured logs and persists provisioning status fields for support/debugging.

### I6. Surface segregation
Customer sessions must never land on workforce routes or internal admin surfaces.
Customer portal and workforce portal must be separated by auth client and UI routing.

## 3. Locked v1 decisions

These decisions are fixed for v1 and should not be reopened during implementation.

- Auth model: Cognito-native customer users
- User pool strategy: same user pool as the current app
- App client strategy: separate customer app client in the same user pool
- Login UX: Hosted UI
- Tenant claim: `custom:customerId`
- User discriminator: `custom:userType = customer`
- Portal provisioning trigger: backend transition to `roleStatus = established`
- Email delivery pattern: custom email flow with invite/setup link, not Cognito default invite email

Rationale:
- same user pool avoids large auth migration
- separate customer app client gives smallest blast-radius separation between workforce and customer surfaces
- Hosted UI reduces password/reset edge cases
- backend trigger avoids UI-driven drift

## 4. Customer entry criteria

A customer can receive portal access only if all of the following are true:
- `Customers.roleStatus == "established"`
- `Customers.externalId` exists
- `Customers.accountIds` is non-empty
- `Customers.adminEmail` exists

If any are missing:
- do not provision customer portal access
- persist a provisioning failure state on the customer record
- emit a structured log with the missing prerequisite

## 5. Repo-mapped current trigger points

### 5.1 Canonical established transition
Current successful role verification happens in:
- `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/amplify/backend/function/teamVerifyCustomerRole/src/index.js`

At the current established transition:
- lines 143-154 set `roleStatus = 'established'`
- `roleEstablishedAt` and `lastRoleVerification` are updated

This is the canonical trigger point for portal provisioning.

### 5.2 Auto-verify path
Current auto-verify is in:
- `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/amplify/backend/function/teamAutoVerifyRole/src/index.js`

This function currently invokes `teamVerifyCustomerRole`, so the auto path already funnels through the same verification path.

Implementation rule:
- still extract a dedicated helper or post-establish hook so the provisioning logic is not embedded ad hoc in multiple places
- if any other future path sets `roleStatus = established`, it must call the same helper

Recommended helper name:
- `post_establish_portal_provision(customerId)`

## 6. Critical current auth hazards

These are already present in the current repo and must be addressed before enabling customer portal users.

### 6.1 App bootstrap assumes workforce-only claims
Current app bootstrap is in:
- `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/src/App.js`

Current logic at lines 67-75 assumes all users have:
- `payload.userId`
- `payload.groupIds`
- `payload.groups`
- `payload["cognito:groups"]`

That is incompatible with customer users unless explicit branching is added.

### 6.2 Pre-token generation assumes IDC username format
Current pre-token generation trigger is in:
- `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/amplify/backend/function/team06dbb7fcPreTokenGeneration/src/index.py`

Current logic at line 101 splits `event["userName"]` on `_` and assumes workforce Identity Center format.

That is incompatible with customer portal users unless explicit customer-user branching is added.

### 6.3 Shared GraphQL model auth is too broad for same-pool customer users
Current `Customers` auth in:
- `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/amplify/backend/api/team/schema.graphql`

Current auth includes:
- `CustomerAdmin` group read
- `private` read
- IAM private read/update

Minimum safe rule for v1:
- customer portal users must not receive general `private` access to shared `@model` types
- customer portal data must be exposed only through dedicated Lambda-backed queries that derive `customerId` from token claims

This rule also applies to audit review of related shared models such as:
- `Customers`
- `Eligibility`
- `Settings`
- `Approvers`

## 7. Provisioning contract

### 7.1 What happens when customer becomes established
When the customer transitions to `roleStatus = established`, the system must:
1. ensure customer portal user exists in Cognito
2. generate a secure, time-bounded setup invite
3. send Email #2 with portal link + setup instructions
4. persist provisioning state on the customer record

### 7.2 Cognito provisioning model
Use Cognito admin APIs to create the user with:
- `email = Customers.adminEmail`
- `custom:customerId = Customers.id`
- `custom:userType = customer`

Provisioning rule:
- use `AdminCreateUser` with `MessageAction: SUPPRESS`
- do not use Cognito default temp-password email
- if user already exists, reconcile attributes instead of recreating

### 7.3 Invite/setup mechanism
Do not send passwords through the backend or by email.

v1 invite/setup mechanism:
- create user with `AdminCreateUser(MessageAction=SUPPRESS)`
- generate a one-time or time-bounded invite token stored by hash on the customer record
- Email #2 links to `/customer-setup?token=...`
- customer setup UI validates token via backend
- UI then uses Cognito password reset/setup flow
- backend never accepts raw password values

This avoids:
- password-in-email
- password handling in your backend
- reliance on Cognito default invite email content

## 8. Required customer record fields

Add these fields to `type Customers` in schema as the source of truth for provisioning and retries:
- `portalUserEmail: String`
- `portalUserSub: String`
- `portalUserStatus: String`
- `portalUserCreatedAt: AWSDateTime`
- `portalInviteTokenHash: String @index(name: "byPortalInviteTokenHash")`
- `portalInviteExpiresAt: AWSDateTime`
- `portalInviteSentAt: AWSDateTime`
- `portalInviteStatus: String`
- `portalInviteError: String`
- `portalProvisioningVersion: String`

Semantics:
- `portalUserStatus`: `not_created | created | failed`
- `portalInviteStatus`: `not_sent | sent | failed | consumed`
- `portalProvisioningVersion`: pin provisioning logic version for idempotent upgrades

## 9. Customer auth and routing requirements

### 9.1 Customer token claims
Customer sessions must include:
- `custom:customerId`
- `custom:userType = customer`

Optional:
- `custom:customerName`
- `custom:customerRole = customerAdmin`

### 9.2 Route guard
Customer routes require:
- authenticated user
- `custom:userType == customer`
- valid `custom:customerId`

If missing/invalid:
- deny access explicitly
- show a deterministic support message

### 9.3 Workforce segregation
Workforce users continue through the existing path.
Customer users must not render internal nav or internal routes.

## 10. Customer dashboard v1 scope

Customer dashboard route:
- `/customer`

v1 dashboard must show only tenant-scoped data for the authenticated customer:
- customer name
- account IDs registered under that customer
- recent access activity scoped to that customer accounts
- status/outcome of access activity where available

v1 is intentionally read-only.
No customer self-service admin features are required in v1.

## 11. Required server-side authorization rule

For every customer-portal API:
- target customer scope must be derived from `claims.custom:customerId`
- customer-controlled inputs must never determine tenant scope

Forbidden:
- accepting a `customerId` input and trusting it without claim validation
- partial data returns across tenants
- fallback to broader reads when claim is missing

## 12. Implementation plan mapped to repo

### Deploy Unit 0 — portal auth isolation
Goal:
- separate customer portal auth surface from workforce auth surface

Changes:
- create separate Cognito app client for customer portal in the existing user pool
- customer app client callback URLs must be customer-only routes
- store customer client config in frontend configuration
- do not change workforce client behavior

Verifiable artifacts:
- customer Hosted UI entry uses customer app client
- customer callback routes land only on customer setup / customer routes
- workforce login unchanged

### Deploy Unit 1 — claims branching
Goal:
- make token generation and app boot explicitly branch workforce vs customer users

Changes:
- modify `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/amplify/backend/function/team06dbb7fcPreTokenGeneration/src/index.py`
  - branch customer users from workforce users
  - inject `custom:customerId` and `custom:userType = customer`
  - do not run workforce Identity Center logic for customer users
- modify `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/src/App.js`
  - branch on `custom:userType`
  - customer users go to customer portal shell
  - workforce users continue to internal shell

Verifiable artifacts:
- customer login renders customer shell only
- workforce login renders existing internal shell
- no customer session can hit workforce nav

### Deploy Unit 2 — auth-surface hardening
Goal:
- prevent customer users from getting broad GraphQL access through shared model auth

Changes:
- tighten schema auth on shared models where customer users could leak through `private` or broad group auth
- for customer portal data, use dedicated Lambda-backed queries only
- do not expose direct shared `@model` reads to customer users

Verifiable artifacts:
- admin flows still work
- customer users cannot call shared admin model queries successfully
- schema/API diff is explicit and narrow

### Deploy Unit 3 — post-establish provisioning backend
Goal:
- provision customer portal access exactly once after establishment

Changes:
- add portal provisioning fields to `Customers`
- add new lambda `teamProvisionCustomerPortalAccess`
- modify `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/amplify/backend/function/teamVerifyCustomerRole/src/index.js`
  - invoke the provisioning helper after successful establish
- keep `established` even if provisioning fails

Behavior:
- validate prerequisites (`adminEmail`, `externalId`, `accountIds`, `established`)
- ensure Cognito user exists
- create invite token
- send Email #2
- persist provisioning status

Verifiable artifacts:
- customer row gets portal provisioning fields
- structured logs show provisioning start/success/failure
- re-verification does not duplicate user/invite unexpectedly

### Deploy Unit 4 — secure customer setup flow
Goal:
- allow customer to set password without email password delivery and without backend receiving password

Changes:
- add lambda `teamGetCustomerPortalSetup`
- add customer setup page `/customer-setup`
- validate invite token and expiry
- UI performs Cognito password setup/reset flow
- backend marks invite consumed after successful setup path

Verifiable artifacts:
- Email #2 contains setup link, not password
- expired or reused invite token is rejected deterministically
- customer completes setup and can sign in

### Deploy Unit 5 — customer dashboard v1
Goal:
- deliver tenant-scoped customer dashboard with minimal read-only visibility

Changes:
- add lambda `teamGetCustomerPortalDashboard`
- add customer dashboard UI `/customer`
- use claim-derived customer scope only
- use minimal customer-scoped activity data source

Verifiable artifacts:
- customer sees only their own tenant data
- no `customerId` input is needed for dashboard fetch
- tampering cannot cross tenant boundary

## 13. Observability requirements

Every provisioning and customer-login step must emit structured logs with at least:
- `customerId`
- `adminEmail`
- `action`
- `status`
- `errorCode` if failed
- `errorMessage` if failed

Suggested action names:
- `customer_portal_provision_started`
- `customer_portal_user_created`
- `customer_portal_user_exists`
- `customer_portal_invite_sent`
- `customer_portal_invite_failed`
- `customer_portal_setup_validated`
- `customer_portal_setup_consumed`
- `customer_portal_claims_issued`

## 14. Acceptance tests

### A. Golden path
1. Admin creates customer with `adminEmail`
2. Customer approves invitation and deploys stack
3. Verification sets `roleStatus = established`
4. System provisions customer user and sends Email #2 exactly once
5. Customer clicks setup link and completes password setup
6. Customer logs in through Hosted UI
7. Customer lands on `/customer`
8. Customer sees only their tenant data

### B. Idempotency
- re-running verification/provisioning does not create duplicate users
- invite status fields remain consistent
- duplicate Email #2 is not sent unless an explicit retry path is used

### C. Tenant isolation
- customer cannot access another customer dashboard by tampering URL or API inputs
- claim mismatch is denied server-side

### D. Security
- no password appears in email templates, logs, or backend payloads
- backend never accepts raw password values for customer setup

## 15. Out of scope (v2+)
- customer SSO / federation (SAML/OIDC)
- multiple customer users and customer-side RBAC
- advanced self-service user management
- advanced reporting or SIEM-grade analytics UI

## 16. First implementation recommendation

Do not start with dashboard UI.

Start with:
1. Deploy Unit 0 — portal auth isolation
2. Deploy Unit 1 — claims branching
3. Deploy Unit 2 — auth-surface hardening
4. Deploy Unit 3 — post-establish provisioning backend

The first behavior worth shipping is:
- customer becomes `established`
- customer portal access is provisioned exactly once
- invite state is visible in `Customers`
- workforce auth remains intact
