# ADR Addendum: Model B Gate-1 Migration Constraints

- Status: Approved for transition
- Date: 2026-03-05
- Scope: Transition from legacy Eligibility shape to Model B Gate-1 contract
- Parent ADR: `ADR_MODEL_B_GATE1_CONTRACT.md`

## Purpose

Define temporary compatibility constraints during migration without changing the target-state Gate-1 contract.

## Target Contract (unchanged)

The target Gate-1 contract remains:

- principal -> customer authorization only
- Gate-1 does not define account universe
- Gate-1 does not define approver routing

See `ADR_MODEL_B_GATE1_CONTRACT.md`.

## Transitional Constraints

During migration, legacy Eligibility fields may remain in schema and payloads:

- `accounts`
- `ous`
- `permissions`

These fields are **deprecated transport fields** and are not authoritative for Model B decisions.

## Authoritative Sources (must hold during migration)

- Gate-1 requester authorization: eligibility principal + `customerId`
- Gate-2 account universe: `Customers.accountIds`
- Gate-3 approval routing: `Customers.approverGroupIds`

## Transitional Implementation Rules

1. Gate-1 write path must persist customer context (`customerId`, `customerName`) and must not persist copied customer account lists.
2. If legacy fields must still be written for compatibility, they must be written as empty values:
   - `accounts: []`
   - `ous: []`
   - `permissions: []`
3. Runtime logic must not use legacy fields as source of truth for Gate-2 or Gate-3 in Model B paths.
4. Any fallback using legacy org-based semantics is temporary and must be explicitly marked as migration-only.

## Sunset Condition

This addendum is temporary and can be retired when both are true:

1. Request and entitlement runtime paths no longer require legacy transport fields.
2. Schema and generated clients remove deprecated Eligibility fields or treat them as no-op compatibility fields.

