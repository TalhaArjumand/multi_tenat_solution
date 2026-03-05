# ADR: Model B Gate-1 Authorization Contract

- Status: Approved for implementation planning
- Date: 2026-03-05
- Scope: Model B only (external customer accounts, mt-* roles)
- Change type: Contract freeze (no runtime code change in this ADR)

## Context

The legacy Eligibility Policy form and data shape were designed for org-based access control (org accounts, OUs, SSO permission set semantics). Model B uses external customer accounts and mt-* role flows. Reusing the old object shape as-is causes semantic drift.

To prevent drift, Gate boundaries must be explicit:

- Gate-1: requester authorization
- Gate-2: target scoping
- Gate-3: approval routing

This ADR freezes Gate-1 semantics first, before any UI or backend redesign.

## Decision

Adopt Option C:

1. Phase-now Gate-1 meaning is `principal -> customer` authorization only.
2. Gate-1 is a distinct authorization check and MUST NOT be inferred from visibility.
3. Role-bounded authorization (`principal -> customer + allowed mt-roleIds`) is deferred as a future extension.

## Normative Contract

### Gate-1 meaning (now)

For Model B, Gate-1 answers only:

"Is this principal authorized to submit requests in this customer context?"

### Gate-1 non-meanings

Gate-1 MUST NOT define:

- account universe
- OU scope
- org-account allowlists
- SSO permission-set semantics
- approver routing

### Gate separation

- Gate-1 requester auth source: entitlement/assignment mechanism for principal-to-customer authorization
- Gate-2 account source: `Customers.accountIds` for selected customer
- Gate-3 approver source: `Customers.approverGroupIds` for selected customer

### Enforcement rules

- Deny by default on missing/unknown/invalid Gate-1 signal.
- Customer selection scopes context but does not grant submit rights.
- UI checks are advisory; backend is authoritative.
- Submit MUST be blocked before create when Gate-1 fails.
- Gate-1 MUST be evaluated at request creation and MAY be revalidated before downstream execution if the workflow is delayed or data may have changed.

## Failure behavior (required)

The system MUST fail explicitly with a primary cause for at least:

- customer not selected
- customer unknown or not requestable
- principal not authorized for selected customer
- missing Gate-1 signal

Failure MUST be explicit; no silent fallback to broader access or later-stage rejection.

## Acceptance checks (merge gate for Gate-1 work)

All must be true:

1. Gate-1 data model includes customer context explicitly.
2. Gate-1 object has no OU field.
3. Gate-1 object has no org-account allowlist field.
4. Gate-1 object has no SSO permission-set semantic dependency.
5. Unauthorized principal is denied before request creation.
6. Gate-2 account list is still sourced only from `Customers.accountIds`.
7. Gate-3 approver routing is still sourced only from `Customers.approverGroupIds`.

## Migration posture

- Temporary legacy eligibility can remain only as a Gate-1 authorization source during migration.
- Legacy logic MUST NOT be reused for Gate-2 or Gate-3.
- Future extension to role-bounded Gate-1 is allowed only via a new ADR that defines:
  - data shape
  - migration plan
  - acceptance checks

## Architectural rationale

This decision keeps responsibilities orthogonal and prevents model mixing:

- Gate-1 authorizes who can request.
- Gate-2 defines what accounts belong to selected tenant context.
- Gate-3 defines who approves.

This aligns with Model B invariants and reduces long-term drift risk.
