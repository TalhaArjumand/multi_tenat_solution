---

# RFC: Model B Access Control (External Customer Accounts,mt-Roles)

## 1. Purpose

Define the required end-to-end behavior for **Model B** in CloudIQS MSP, where:

- customer AWS accounts remain external to MSP organizational ownership,

- access is requested against customer-owned AWS accounts,

- access is delivered through customer-account IAM roles using an AssumeRole-style mechanism,

- Model B requests use mt-* role identifiers.

This document is **normative**.

Any implementation that violates these requirements is non-compliant and out of scope.

---

## 2. Scope

This RFC applies to the full Model B runtime flow, including:

- customer data management

- requester visibility and request creation

- request validation

- authorization checks

- approval routing and approval decisioning

- grant execution

- access expiry / end-of-access handling

- audit and observability

- active-access user experience (console link and/or temporary credentials)

This RFC applies to all relevant stakeholders in the Model B flow:

- requester

- approver

- customer administrator / MSP administrator managing customer config

- grant execution service

- audit / operations observers

Out of scope:

- Model A / Identity Center assignment model

- UI styling

- non-security UX preferences

- internal-only admin diagnostics that do not affect runtime decisions

---

## 3. Definitions

### 3.1 Actors

- **Requester**: authenticated CloudIQS user attempting to request access.

- **Approver**: principal authorized to approve Model B requests for a customer.

- **Customer administrator**: actor that manages customer metadata (for example, account membership and approver groups).

- **Grant executor**: system component that produces time-bounded access.

- **Auditor / operator**: actor or system reviewing logs, failures, and lifecycle state.

### 3.2 Entities

- **Customer**: a tenant in CloudIQS MSP.

- **Customer account**: an AWS account owned by the customer and external to MSP org ownership.

- **Request**: a time-bounded access request to a customer account.

- **Grant**: the action that produces time-bounded access.

- **Revocation / access end**: the mechanism by which granted access becomes unusable and is reflected as ended.

### 3.3 Identifiers

- customerId: unique identifier for a Customer.

- accountId: AWS 12-digit account ID.

- roleId: access role identifier.

- mtRoleId: any roleId matching ^mt-.

- requestId: unique identifier for a Request.

### 3.4 Access Models

- accessModel ∈ { MT, SSO }

- MT is Model B and is governed by this RFC.

- For Model B requests:

    - accessModel MUST be MT

    - roleId MUST match ^mt-

If code infers the model from roleId, runtime behavior MUST still be equivalent to explicit branching on accessModel = MT.

### 3.5 Policy Terms

- **Requester authorization**: whether the requester is allowed to submit a request for a selected customer and target account/role.

- **Target scoping**: how the set of selectable customer accounts is determined.

- **Approval routing**: how the set of approvers is determined.

- **Approval policy enabled**: whether the customer/request type requires approval before grant.

- **No silent fallback**: no hidden substitution, auto-broadening, alternate source lookup, or deferred rejection in place of explicit validation failure.

---

## 4. Data Contracts (Source of Truth)

### 4.1 Customer Record (minimum required fields)

For active Model B customers, the source of truth MUST include:

- id (customerId)

- name

- accountIds: string[]

    - MUST be non-empty for an active requestable Model B customer

    - MUST contain only valid AWS 12-digit account IDs

- approverGroupIds: string[]

    - REQUIRED when approval policy is enabled

- roleStatus

    - indicates whether Model B customer role configuration is operational (for example: established)

- approvalPolicy or equivalent policy state

    - MUST indicate whether approval is required

- requestabilityStatus or equivalent operational state

    - MUST indicate whether requests may currently be submitted for this customer

Optional but recommended:

- allowedRoleIds: string[] or equivalent role policy reference

- grantConfigVersion or equivalent version marker for auditable grant behavior

### 4.2 Request Record (Model B Required Fields)

A Model B request record MUST include:

- requestId

- customerId

- accountId

- roleId where roleId is mtRoleId

- accessModel = MT

- duration (policy bounded)

- ticketNo (when policy requires)

- justification

- requestedBy

- lifecycle status

- timestamps for creation and status transitions

### 4.3 Request Lifecycle Statuses

At minimum, status MUST be one of:

- pending

- approved

- in-progress

- active (if the system distinguishes granted vs still provisioning)

- ended

- expired

- rejected

- error

If active is not separately modeled, the implementation MUST still preserve a clear state transition between approval and access end.

### 4.4 Audit Record Requirements

The system MUST retain enough data to reconstruct:

- who requested

- what customer/account/role was requested

- which authorization rule allowed or denied submit

- which approver set was evaluated

- which execution path ran

- why a request failed, was rejected, or ended

---

## 5. End-to-End Core Invariants (Normative)

### 5.1 Tenant Boundary Invariant

Customer accounts are external, and AWS Organizations MUST NOT participate in Model B runtime access decisions.

Runtime flows that MUST NOT depend on Organizations APIs:

- request form account selection

- requester authorization for customer requests

- approval routing for customer requests

- grant execution for customer requests

- revoke / access-end handling for customer requests

Organizations integration MAY exist only for admin diagnostics or inventory and MUST be isolated from runtime decision-making.

---

### 5.2 Customer Context Invariant

Customer selection is the root tenant scope for Model B.

For every Model B request:

- customerId is REQUIRED

- all downstream runtime behavior MUST operate within the selected customer context

Customer context is the governing scope for:

- target account selection

- role availability evaluation

- requester authorization evaluation

- approval routing

- role mapping

- grant execution configuration

---

### 5.3 Requester Authorization Invariant

Customer selection scopes the tenant context, but does **not** by itself grant request rights.

For Model B:

- a requester MUST pass a distinct authorization check before submit is allowed

- customer visibility or customer selection MUST NOT be treated as equivalent to submit permission

- account visibility MUST NOT be treated as equivalent to submit permission

- role visibility MUST NOT be treated as equivalent to submit permission

This authorization gate MUST be evaluated before request creation succeeds.

A system is non-compliant if any authenticated request-capable user can submit solely because a customer is visible or selected.

---

### 5.4 Requester Authorization Source Invariant

The source of requester authorization MAY be:

- an existing entitlement object,

- explicit customer-to-user mapping,

- explicit customer-to-group mapping,

- another auditable entitlement mechanism,

but it MUST satisfy all of the following:

- it is separate from account-universe computation,

- it is separate from approver routing,

- it is evaluated explicitly,

- it is auditable,

- it cannot be bypassed by selecting a customer.

Temporary legacy authorization mechanisms MAY remain in use during migration only if they are used solely for requester authorization and not for customer account universe or approval routing.

---

### 5.5 Customer Requestability Invariant

A customer is requestable only when the customer is operationally eligible for Model B requests.

At minimum, a customer MUST NOT accept Model B requests if any of the following is true:

- accountIds is empty

- role configuration is not operational (roleStatus not established or equivalent)

- approval is required but approverGroupIds is missing or empty

- customer is administratively disabled for requests

The system MUST fail explicitly rather than degrade into partial behavior.

---

### 5.6 Account Universe Invariant

Selectable accounts for Model B are exactly Customers.accountIds for the selected customer.

Required create-time validation:

- accountId ∈ Customers.accountIds(customerId)

Prohibited computations:

- orgAccounts ∩ customerAccounts

- OU-based expansions

- MSP-org hierarchy derived account discovery

- synthetic “all visible org accounts” fallbacks

- hidden broadening from requester-side eligibility data

The account universe MUST be customer-defined, not org-defined and not requester-entitlement-defined.

---

### 5.7 Account Visibility vs Submit Invariant

The system MAY display a customer’s scoped accounts only within the selected customer context, but account visibility MUST NOT override requester authorization.

Therefore:

- showing an account in the UI does not imply the requester may submit for it

- API validation MUST enforce submit authorization independently of UI visibility

- if account visibility and submit authorization differ, submit MUST be blocked explicitly

This prevents UI-only scoping from becoming a security boundary.

---

### 5.8 Role Universe Invariant

For Model B, only valid mt-* roles may be requested.

The requestable role universe for a selected (customerId, accountId) MUST be explicitly governed by an auditable source.

That source MAY be:

- customer-configured allowed roles,

- deterministic role mapping policy,

- requester-entitlement-constrained role permissions,

- or a combination of these,

but the implementation MUST define this source explicitly and MUST NOT infer role availability from unrelated SSO constructs.

At minimum:

- roleId MUST match ^mt-

- the selected roleId MUST be valid for the selected customer/account

- the selected roleId MUST be valid for the requester’s authorization scope if requester authorization is role-bounded

---

### 5.9 Role Determinism Invariant

For (customerId, accountId, roleId) in Model B:

- resolution MUST produce exactly one target IAM role ARN

- resolution MUST be deterministic

- resolution MUST be auditable

- resolution MUST fail explicitly if zero or multiple valid targets exist

The system MUST never “guess” a target role.

---

### 5.10 Approval Universe Invariant

Approvers for Model B are customer-scoped.

For Model B approval routing:

- the approver source of truth MUST be Customers.approverGroupIds

- account-level fallback tied to Organizations hierarchy is prohibited

- OU-level fallback tied to Organizations hierarchy is prohibited

- non-customer-scoped fallback is prohibited

Approval routing MUST be derived from selected customer context only.

---

### 5.11 Approval Policy Invariant

The system MUST explicitly determine whether approval is required before submit can complete.

That determination MUST come from an auditable policy source (for example customer policy or request type policy).

If approval is required:

- valid approver routing MUST exist before submit succeeds

- the request MUST enter an approval-governed path

- grant MUST NOT proceed before approval is satisfied

If approval is not required:

- the system MAY proceed without approval

- but this no-approval path MUST still be explicit, auditable, and policy-backed

The system MUST NOT silently switch between approval-required and approval-not-required behavior.

---

### 5.12 Approval Non-Bypass Invariant

When approval is required:

- there is no mt-* bypass

- no special case may skip approval solely because the role is mt-*

- no fallback path may auto-approve due to missing approver resolution

If the requester is also an approver:

- self-approval alone is insufficient

- at least one additional approver is required

- the minimum effective approver count MUST be at least 2

---

### 5.13 Approval Integrity Invariant

Approval decisions MUST be bound to the exact request context.

An approval is only valid for the exact:

- requestId

- customerId

- accountId

- roleId

- relevant duration / policy-bounded parameters

Approvals MUST NOT be reusable across requests or transferable across customers/accounts.

---

### 5.14 Access Mechanism Invariant

Model B grants access through customer-account IAM roles.

Grant execution MUST use:

- sts:AssumeRole, or

- an equivalent broker that issues time-bounded credentials backed by the target customer role

Model B MUST NOT depend on:

- Identity Center account assignment APIs such as CreateAccountAssignment

- Access Portal visibility

- Identity Center principal existence as a correctness precondition

- SSO-only provisioning state as a correctness precondition

---

### 5.15 Execution Exclusivity Invariant

A Model B request triggers exactly one grant path.

For accessModel = MT:

- only the MT path may execute

- SSO grant steps MUST NOT execute

- dual execution for the same request is prohibited

- partial execution across both paths is prohibited

If mixed execution is detected, the request MUST fail fast.

---

### 5.16 Input Validity Invariant

Model B execution MUST NOT require SSO-only fields as mandatory inputs.

The following MUST NOT be required preconditions for MT grant correctness:

- PrincipalId

- Identity Center userId

- instanceARN

- any SSO-only assignment dependency

Such values MAY exist in shared schemas, but MT runtime correctness MUST not depend on them.

---

### 5.17 Active Access Delivery Invariant

Model B active access delivery is CloudIQS-driven.

The system MUST deliver usable access through:

- a CloudIQS-provided console link, and/or

- CloudIQS-issued temporary credentials, and/or

- an equivalent CloudIQS-controlled brokered access experience

Model B active access MUST NOT depend on:

- Access Portal assignment visibility

- Identity Center application tile presence

- external manual steps not recorded by CloudIQS as part of normal runtime grant success

---

### 5.18 Time-Bounded Access Invariant

All Model B access is time-bounded.

For each granted request:

- duration MUST be policy bounded

- effective access MUST have a determinable end

- the end condition MUST be traceable and auditable

No indefinite Model B grant is compliant unless an explicit separate policy permits it and is recorded.

---

### 5.19 Revocation / Access-End Invariant

Model B access must end deterministically.

Primary end-of-access behavior:

- credential expiry is the primary enforcement mechanism, unless the broker implements an equivalent stronger expiry control

The system MUST also:

- transition the request to ended or expired (or equivalent terminal state)

- record end timing clearly

- record whether the end was normal expiry, manual termination, rejection before grant, or error-related termination

The lifecycle state must reflect access end even if credential expiry is the enforcement mechanism.

---

### 5.20 Lifecycle State Invariant

Request lifecycle transitions MUST be valid, deterministic, and auditable.

At minimum:

- pending → approved only after approval requirements are satisfied

- approved → in-progress only when grant execution starts

- in-progress → active (if modeled) only when grant succeeds

- active → ended/expired when access term ends

- any state → error only with explicit failure cause

- pending → rejected only via approval rejection or authorization/policy rejection before grant

- terminal states MUST NOT silently re-enter non-terminal states

The system MUST NOT collapse distinct failure modes into ambiguous status without traceable cause.

---

### 5.21 Explicit Failure Invariant

Model B runtime behavior MUST fail explicitly on invalid inputs, invalid state, or invalid routing.

The system MUST NOT:

- silently broaden scope

- silently substitute a different data source

- silently skip approval

- silently switch execution models

- silently create best-effort grant behavior

A blocked request is compliant. A hidden fallback is not.

---

### 5.22 Auditability Invariant

Every security-relevant decision in the Model B flow MUST be reconstructible.

This includes, at minimum:

- why the requester was allowed or denied

- why the target account was considered valid

- why the selected role was considered valid

- whether approval was required

- which approver groups were evaluated

- why approval passed, failed, or was blocked

- which exact IAM role ARN was resolved

- which execution path ran

- when access began

- when and why access ended

If a decision cannot be reconstructed from retained records, the implementation is non-compliant.

---

### 5.23 Deny-by-Default Invariant

Model B enforcement is deny-by-default.

If any required gate signal is missing, unknown, stale, unreadable, or non-resolvable, the system MUST deny the operation rather than fallback, infer success, or continue with partial evaluation.

This applies to, at minimum:

- requester authorization inputs

- customer operational/requestability state

- account-universe data

- role validity / role mapping inputs

- approval-policy state

- approver routing inputs

- execution-path selection inputs

Missing signal is a valid reason to block. It is never a valid reason to broaden access.

---

### 5.24 Gate Precedence Invariant

Model B gate evaluation order MUST be fixed and preserved.

The required order is:

1. Gate 1 — Requester authorization

2. Gate 2 — Target scoping and target validity

3. Gate 3 — Approval policy and approver routing

4. Grant execution

Later gates MUST NOT compensate for earlier gates.

Specifically:

- approval routing MUST NOT be used as a substitute for requester authorization

- grant execution MUST NOT begin before all prior required gates pass

- a request failing an earlier gate MUST NOT continue to later gates

Any implementation that evaluates gates out of order in a way that changes security outcome is non-compliant.

---

### 5.25 Backend-Authoritative Enforcement Invariant

The backend is the final enforcement authority for Model B.

UI checks, prefilters, warnings, disabled controls, and optimistic validations are advisory only and MUST NOT be treated as the security boundary.

The API/backend MUST re-validate all required Model B gates before:

- request creation

- approval acceptance

- grant execution

- any state transition that changes effective access outcome

A request that is blocked in UI but accepted by backend is non-compliant. A request that appears valid in UI but fails in backend is compliant if backend enforcement is correct and explicit.

---

### 5.26 TOCTOU Revalidation Invariant

Model B MUST defend against time-of-check / time-of-use drift.

Any security-relevant workflow stage that occurs after initial submit MUST re-validate all still-relevant runtime conditions before continuing.

At minimum, before grant execution begins, the system MUST re-check:

- customer requestability / operational state

- target account still belonging to the selected customer

- selected role still being valid for the selected customer/account

- deterministic role mapping still resolving to exactly one valid target

- approval policy still applicable

- required approver configuration still present

- request state still valid for execution

Approval and grant MUST NOT rely solely on data that was valid only at initial submit time if that data may have changed.

---

### 5.27 Idempotency and Replay-Safety Invariant

Model B grant processing MUST be idempotent and replay-safe.

Duplicate or repeated events for the same requestId MUST NOT cause duplicate grants, duplicate state transitions, or duplicate effective access issuance.

This applies to, at minimum:

- repeated submit attempts

- repeated approval events

- repeated workflow retries

- duplicate queue deliveries

- retried grant-execution invocations

The system MUST ensure that the same request cannot produce multiple distinct active grants unless explicitly modeled and authorized as part of a separate contract.

---

### 5.28 Migration Control Invariant

Temporary legacy mechanisms MAY exist only under explicit migration control.

If a legacy eligibility or entitlement mechanism is temporarily retained, then all of the following MUST be true:

- its use is explicitly limited to Gate 1 (requester authorization) only

- it MUST NOT define the customer account universe

- it MUST NOT define approval routing

- its use MUST be documented as temporary

- its replacement target mechanism MUST be identified

- its sunset condition MUST be explicitly defined

A legacy mechanism that silently expands beyond Gate 1 is non-compliant.

---

## 6. Required Failure Behavior

The system MUST block or fail explicitly in the following cases:

- missing customer selection

- customer not requestable / not operational for Model B

- missing or invalid customerId

- account not in selected customer’s accountIds

- requester not authorized for selected customer

- requester not authorized for selected account, if authorization is account-bounded

- requester not authorized for selected role, if authorization is role-bounded

- selected roleId not valid for selected customer/account

- roleId does not match ^mt-

- approval required but approverGroupIds missing or empty

- approval required but approver resolution yields no valid approver path

- role mapping failure

- zero or multiple target role mappings

- mixed execution path detected

- MT path depends on SSO-only required input

- invalid lifecycle transition detected

- missing, unknown, stale, unreadable, or non-resolvable required gate signal

- gate evaluation attempted out of required order

- stale runtime data detected during required revalidation

- duplicate or replayed event for same requestId that would cause duplicate grant

Required behavior:

- reject before create when possible

- otherwise set request to error with one explicit primary cause

- do not silently retry through a different model

- do not rely on later approver rejection as a substitute for earlier authorization failure

- deny by default when required signals are missing or unknown

- do not issue duplicate grants for duplicate/replayed events

No silent fallbacks.

---

## 7. Observability and Audit Requirements

Each request lifecycle MUST log, at minimum:

- requestId

- customerId

- accountId

- roleId

- effective accessModel

- requestedBy

- requester authorization evaluation source and result

- whether approval was required and why

- approver groups evaluated

- requester-is-approver branch outcome

- approval decision result

- resolved target role ARN

- selected execution path (MT only for Model B)

- grant start event

- grant success or failure

- access end event

- single primary failure cause when failed

- gate evaluation order

- which gate failed

- whether deny-by-default was triggered

- whether revalidation was performed before grant

- whether an event was treated as duplicate/replay and suppressed

- which legacy authorization source was used, if any, during migration period

Logs MUST be sufficient to support:

- security investigation

- compliance verification

- operator diagnosis

- post-incident reconstruction

---

## 8. Actor Responsibilities (Normative)

### 8.1 Requester

A requester MAY submit a Model B request only when:

- a valid customer is selected,

- the customer is requestable,

- the target account is within that customer’s account universe,

- the selected role is valid,

- the requester passes explicit authorization,

- required fields are present,

- policy requirements are satisfied.

The requester MUST NOT gain submit rights merely by being able to view a customer, account, or role.

### 8.2 Approver

An approver MAY approve only requests routed through the selected customer’s approver groups.

An approver decision MUST apply only to the exact request under review and MUST NOT create approval for unrelated requests.

If the requester is also an approver, the system MUST still require an additional approver where approval is required.

### 8.3 Customer Administrator / MSP Administrator

Actors managing customer metadata MUST ensure the customer record remains internally consistent.

In particular, they MUST NOT configure a customer as requestable when:

- accountIds is empty,

- role configuration is not operational,

- approval is required but approver groups are missing.

Administrative diagnostics MAY reference Organizations data, but MUST NOT feed runtime authorization, scoping, or grant decisions.

### 8.4 Grant Executor

The grant executor MUST:

- execute only the MT path for Model B,

- use deterministic role resolution,

- produce time-bounded access only,

- fail explicitly on invalid configuration or mixed-path conditions,

- never substitute an SSO path.

### 8.5 Auditor / Operator

Auditors and operators MUST be able to determine from retained records:

- who requested,

- what was requested,

- why it was allowed,

- who could approve,

- how it was granted,

- when it ended,

- why it failed if it failed.

If this cannot be determined, the system fails the auditability requirement.

---

## 9. Model B Acceptance Gate

A build is Model B compliant only if all of the following are true:

1. Customer selection constrains the account dropdown to exactly customer.accountIds.

2. mt-* submit is blocked unless a valid customer is selected and loaded.

3. Submit is blocked unless the requester passes a distinct requester-authorization check.

4. Customer selection does not itself grant submit permission.

5. mt-* approvals use customer approver groups only.

6. If approval is required and no valid approver route exists, submit is blocked.

7. Model B role selection accepts only valid mt-* roles allowed for the selected customer/account.

8. Model B grant uses the MT path only (AssumeRole / broker), never SSO assignment.

9. MT execution does not depend on SSO-only required fields.

10. Active access delivery is CloudIQS-driven, not Access Portal assignment visibility.

11. Access ends deterministically and lifecycle state reflects that end.

12. Logs are sufficient to reconstruct authorization, approval, execution path, and end-of-access.

---

## 10. Merge Gate Questions (Mandatory)

Before merge, every answer MUST be **yes**:

1. Does this change preserve customer-scoped account selection?

2. Does this change preserve a distinct requester-authorization gate?

3. Does customer selection remain a scope input rather than an authorization grant?

4. Does customer runtime logic avoid Organizations dependency?

5. Does mt-* approval resolve from Customers.approverGroupIds only?

6. If approval is required, does the system block when no valid approver path exists?

7. Does mt-* role selection remain explicitly validated for the selected customer/account?

8. Does mt-* grant/revoke remain MT-only?

9. Does MT runtime avoid SSO-only required dependencies?

10. Does this change preserve deterministic, auditable role resolution?

11. Does this change preserve explicit failure behavior with no silent fallback?

12. If Organizations-related code exists, is it admin-only and isolated?

13. Does this change preserve deny-by-default when required signals are missing or unknown?

14. Does this change preserve fixed gate order: requester auth → target scope → approval routing → grant?

15. Does backend remain authoritative over UI for all enforcement points?

16. Does the workflow re-validate runtime-critical state before grant?

17. Is grant processing idempotent and replay-safe for the same requestId?

18. If legacy Gate 1 logic remains, is it explicitly constrained to Gate 1 with a defined sunset path?

---

## 11. Implementation Guidance Boundary (Non-Normative)

The following are allowed implementation choices, provided all invariants above remain true:

- UI may pre-filter visible accounts after customer selection.

- UI may optimistically hide roles the requester likely cannot request.

- Backend remains the final enforcement point for authorization and validity.

- Legacy entitlement mechanisms may temporarily remain only as the requester-authorization source during migration.

- Shared schemas may include SSO-era fields, provided MT runtime does not require them.

This section is informative only.

If any implementation convenience conflicts with Sections 4–10, Sections 4–10 win.

---

## Why this rewrite is stronger

This version closes the main dangerous ambiguity:

- **customer context**

- **requester authorization**

- **target scoping**

- **approval routing**

are now clearly separated.

That was the missing end-to-end security boundary.

