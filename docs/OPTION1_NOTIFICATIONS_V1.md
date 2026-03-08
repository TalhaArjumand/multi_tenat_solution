# Option 1 Notifications v1

Status
- Version: v1
- Scope: Phase 1 email-only customer visibility and notifications
- Non-goals: no customer portal UX, no customer self-service controls, no customer SSO/federation

## Problem statement

`CloudiQS` needs a low-risk customer-facing visibility layer before any customer portal work proceeds.

Phase 1 delivers:
- tenant-scoped customer email notifications
- customer-controlled notification preferences
- customer-managed distribution email support
- CloudTrail evidence retrieval for customer-account activity
- internal CloudiQS audit for workflow and platform events

Phase 1 does not deliver:
- customer login
- customer dashboard UI
- customer-side grant or approval actions

## Invariants

### I1 — Tenant isolation
All customer-facing output is tenant-scoped:
- derived from `customerId`
- includes only that customer's `accountIds`
- never guesses or merges across customers

### I2 — Customer is visibility-only
Customer cannot:
- create grants
- approve grants
- change workflow or config
- manage approvers

Phase 1 is visibility and notifications only.

### I3 — Revocation remains customer-owned
Customer can always revoke future access by disabling or deleting the cross-account role in their AWS account.

`CloudiQS` does not remove that control or depend on portal access for revocation.

### I4 — Notification preferences are explicit and reversible
- notification destination is customer-controlled
- customer can unsubscribe or change preferences explicitly
- unsubscribe is one-click and logged
- default subscription behavior must be defined per customer and documented

### I4a — v1 recipient model
Phase 1 uses one customer-managed distribution email per customer as the notification target.

### I5 — Split source of truth
Customer CloudTrail is the source of truth for:
- `AssumeRole`
- AWS API activity executed inside the customer account via assumed role credentials

`CloudiQS` internal audit is the source of truth for:
- request created and approved
- grant issued
- console federation link generation
- CLI credential issuance
- revoke and end events
- errors

### I6 — No secrets in customer emails
Never include:
- credentials
- federation URLs or access material
- anything that bypasses policy or control boundaries

Customer emails may include:
- what happened
- when it happened
- which account and role were involved
- how to revoke or stop future access

### I7 — Explicit failure and idempotent retry
If sending or reporting fails:
- record one explicit failure reason in DDB
- do not spam duplicate emails
- retries must be explicit and idempotent

## Protocol

### P1 — One deploy unit, one outcome
Each PR must implement exactly one of:
- a new email summary or alert type
- a new subscription toggle or unsubscribe behavior
- a new audit write or CloudTrail evidence lookup behavior

### P2 — One proof artifact per PR
Every PR must have at least one observable proof artifact:
- DDB row change
- CloudWatch structured log event
- SES message ID

### P3 — Golden path E2E checklist
For one customer, such as `Facebook_test`, prove:
1. request approved
2. grant issued
3. internal CloudiQS audit event written
4. email summary sent, or explicitly skipped due to customer preference
5. CloudTrail evidence is retrievable for the event window
6. unsubscribe prevents the next email

### P4 — No silent fallbacks
For audit and report evidence:
- if CloudTrail evidence is unavailable, return explicit `CloudTrail not available for timeframe`
- do not silently replace CloudTrail evidence with internal logs

For notifications:
- notifications may proceed from internal audited events
- they must not be labeled as CloudTrail-backed evidence unless CloudTrail evidence has actually been retrieved

### P5 — Rollback documented
Every PR must include:
- revert commit(s)
- DDB state to clean or reset
- any Lambda env vars, rules, or IAM policies to disable

## Minimal PR template

```md
## Change goal
<one sentence>

## Invariants (Option 1)
- [ ] I1 Tenant isolation
- [ ] I2 Customer visibility-only
- [ ] I3 Customer-owned revocation
- [ ] I4 Preferences explicit + reversible
- [ ] I4a One distribution email per customer
- [ ] I5 Split source of truth
- [ ] I6 No secrets in emails
- [ ] I7 Explicit failure + idempotent retry

## What changed
- <file/function>
- <file/function>

## Proof artifacts
- DDB: <table + key + fields>
- Logs: <log group + event name>
- SES: <messageId or expected send>

## E2E (Facebook_test)
- [ ] approval -> grant -> internal audit written
- [ ] email sent or explicitly skipped
- [ ] CloudTrail evidence retrievable (async)
- [ ] unsubscribe prevents next email

## Rollback plan
- Revert commit(s): <hash>
- Clean state: <fields to clear>
- Disable: <env var / rule / schedule>
```

## Immediate implementation boundary

Phase 1 starts with:
- notification preference fields
- customer distribution email model
- internal audit event emission on approval, grant, revoke, end, and error
- email delivery on subscribed event types
- unsubscribe flow
- CloudTrail evidence retrieval as a separate audited lookup path

Phase 1 does not include:
- customer portal UI completion
- customer setup UX
- customer read-only dashboard
- customer self-service grant lookup in-app
