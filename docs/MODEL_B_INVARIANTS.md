# RFC: Model B Access Control (External Customer Accounts, `mt-*` Roles)

## 1. Purpose

Define the required behavior (contract) for Model B in CloudIQS MSP:
customers keep AWS accounts external, and access is granted via customer-account
IAM roles (AssumeRole-style) using `mt-*` role identifiers.

This document is normative. Implementations that violate these requirements are out of scope.

## 2. Scope

Applies to:
- customer data management
- request creation and validation
- approval routing
- grant/revoke execution
- active-access user experience (console link and/or temporary credentials)

Out of scope:
- Model A / Identity Center assignment model
- UI styling and non-security UX concerns

## 3. Definitions

### 3.1 Entities

- Customer: a tenant in CloudIQS MSP.
- Customer account: an AWS account owned by a customer and external to MSP org ownership.
- Request: a time-bounded access request to a customer account.
- Approver: a principal authorized to approve customer requests.
- Grant: action that produces time-bounded access.

### 3.2 Identifiers

- `customerId`: unique identifier for a Customer.
- `accountId`: AWS 12-digit account ID.
- `roleId`: access role identifier.
- `mtRoleId`: any `roleId` matching `^mt-`.

### 3.3 Access Model

- `accessModel` in `{ MT, SSO }`.
- `MT` is Model B and governed by this RFC.
- For Model B requests, `accessModel` MUST be `MT` and `roleId` MUST match `^mt-`.

Note: even if code currently infers model from `roleId`, runtime behavior must be equivalent to explicit model branching.

## 4. Data Contracts (Source of Truth)

### 4.1 Customer record (minimum required fields)

For active Model B customers:
- `id` (`customerId`)
- `name`
- `accountIds: string[]` (non-empty)
- `approverGroupIds: string[]` (required when approvals enabled)
- `roleStatus` (for example: `established`)

### 4.2 Request record (Model B required fields)

Must include:
- `customerId`
- `accountId`
- `roleId` where `roleId` is `mtRoleId`
- `duration` (policy bounded)
- `ticketNo` (when policy requires)
- `justification`
- lifecycle status (`pending`, `approved`, `in-progress`, `ended`, `error`)

## 5. Core Invariants (Normative)

### 5.1 Tenant boundary invariant

Customer accounts are external, and AWS Organizations must not participate in customer access runtime flows.

Runtime flows that MUST NOT depend on Organizations APIs:
- request form account selection
- eligibility evaluation for customer requests
- approval routing for customer requests
- grant/revoke execution for customer requests

Organizations integration MAY exist only as admin diagnostics/inventory and MUST be isolated from customer runtime decisions.

### 5.2 Customer scoping invariant

Customer selection is the root scope for Model B:
- `customerId` is REQUIRED for Model B requests
- tenant context for account selection, approval routing, and grant config derives from selected customer

### 5.3 Account universe invariant

Selectable accounts for Model B are exactly `Customers.accountIds` for the selected customer.

Required validation on create:
- `accountId ∈ Customers.accountIds(customerId)`

Prohibited computations:
- `orgAccounts ∩ customerAccounts`
- OU-based expansions tied to MSP org hierarchy

### 5.4 Approver universe invariant

Approvers for Model B are customer-scoped:
- Model B approval routing MUST use `Customers.approverGroupIds`
- No account-level or OU-level fallback tied to AWS Organizations hierarchy

### 5.5 Approval non-bypass invariant

When approvals are enabled:
- no `mt-*` bypass
- if requester is also an approver, at least one additional approver is required (minimum approver count >= 2)

### 5.6 Access mechanism invariant

Model B grants access via customer-account IAM roles:
- grant path MUST use `sts:AssumeRole` or equivalent broker issuing time-bounded credentials

Model B MUST NOT depend on:
- Identity Center account assignments (`CreateAccountAssignment`)
- Access Portal visibility
- Identity Center principal existence for grant correctness

### 5.7 Role mapping invariant

For `(customerId, accountId, roleId)` in Model B:
- role mapping resolves exactly one target IAM role ARN
- mapping is deterministic and auditable

### 5.8 Execution exclusivity invariant

A request triggers exactly one grant path:
- `MT` requests MUST NOT trigger SSO grant steps
- dual execution for same request is prohibited

### 5.9 Input validity invariant

Model B execution MUST NOT require SSO-only fields:
- `PrincipalId` / `userId` (Identity Center principal) as required input
- `instanceARN` as required dependency for MT grant

### 5.10 Revocation invariant

Model B access ends deterministically:
- primary revocation is credential expiry
- request must transition to ended/expired with clear status timing

## 6. Required Failure Behavior

- Missing customer selection: block submit with explicit error.
- Account not in selected customer's `accountIds`: reject request.
- Missing `approverGroupIds` when approval required: block submit.
- Role mapping failure: set request to error with explicit cause.
- Mixed execution path detected: fail fast with explicit "invalid execution path" cause.

No silent fallbacks.

## 7. Observability Requirements

Each request lifecycle must log:
- `requestId`, `customerId`, `accountId`, `roleId`, effective `accessModel`
- approver groups evaluated and result (including requester-is-approver branch)
- resolved role ARN for MT grants
- selected execution path (`MT` or `SSO`)
- single clear failure cause when failed

## 8. Model B Acceptance Gate

A build is Model B compliant only if all pass:
1. Customer selection constrains account dropdown to `customer.accountIds`.
2. `mt-*` submit is blocked unless customer is selected and loaded.
3. `mt-*` approvals use customer approver groups only.
4. Model B grant uses MT path only (AssumeRole/broker), not SSO assignment.
5. Active access delivery is CloudIQS-driven (console link/credentials), not Access Portal assignment visibility.

## 9. Merge Gate Questions (Mandatory)

Before merge, each answer must be "yes":
1. Does this change preserve customer-scoped account selection?
2. Does customer runtime logic avoid Organizations dependency?
3. Does `mt-*` approval resolve from `Customers.approverGroupIds` only?
4. Does `mt-*` grant/revoke remain MT-only?
5. If Organizations code exists, is it admin-only and isolated?
