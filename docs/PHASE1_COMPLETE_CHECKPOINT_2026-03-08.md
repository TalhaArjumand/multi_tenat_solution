# Phase 1 Complete Checkpoint (2026-03-08)

Status
- Phase: Option 1 / Phase 1
- Scope: email-only customer visibility and notification controls
- Baseline code checkpoint before this docs note: `f32d793`
- Repo: `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean`

## Scope completed

Phase 1 is complete for the locked contract in [OPTION1_NOTIFICATIONS_V1.md](/Users/njap/Downloads/steve_work/cloudiqs-msp-clean/docs/OPTION1_NOTIFICATIONS_V1.md).

Included and verified:
- tenant-scoped customer grant notification email routed by `customerId`
- customer-managed delivery target via `Customers.notificationEmail`
- explicit enable/disable via `Customers.notificationsEnabled`
- one-click unsubscribe
- unsubscribe state persistence via `notificationUnsubscribedAt`
- explicit suppression of the next notification after unsubscribe
- CloudTrail evidence helper block in the granted email
- customer-owned revocation guidance in the email
- branding updated to `CloudiQS`

Explicitly not included in Phase 1:
- customer portal UI or customer login
- per-event notification preference matrix
- CloudTrail API lookup automation (`LookupEvents`, CloudTrail Lake, Athena)
- dashboards or reporting UI

## Source-of-truth boundary

Customer CloudTrail is the source of truth for:
- `AssumeRole`
- AWS API activity executed in the customer account via assumed-role credentials

CloudiQS internal audit is the source of truth for:
- request approval and grant workflow
- console-link generation
- CLI credential issuance
- revoke/end
- errors
- unsubscribe actions

## Proof artifacts

### Customer notification delivery
Verified on a real `Facebook_test` flow:
- real MT request approved by customer approver
- requester received access (`Console` and `CLI Creds`)
- customer inbox received the grant notification email

Relevant log signals:
- `CUSTOMER_NOTIFICATION_SENT customerId=... recipientEmail=... status=granted`
- no SES failure in the same send window

Relevant customer fields:
- `notificationEmail`
- `notificationsEnabled`

### Unsubscribe
Verified on the real customer notification email:
- unsubscribe page completed successfully
- customer settings updated
- next notification was suppressed

Relevant log signals:
- `CUSTOMER_NOTIFICATION_UNSUBSCRIBED customerId=...`
- `CUSTOMER_NOTIFICATION_SKIPPED reason=NOTIFICATIONS_DISABLED customerId=...`

Relevant customer fields:
- `notificationsEnabled = false`
- `notificationUnsubscribedAt = <timestamp>`

### CloudTrail Evidence Helper
Verified in the customer notification email:
- `Verify in your CloudTrail` section present
- includes:
  - event name `AssumeRole`
  - UTC evidence window
  - account ID
  - role ARN/name
  - region note
  - revoke reminder

Relevant log signal:
- `CUSTOMER_EVIDENCE_HELPER_INCLUDED=true customerId=... accountId=... eventName=AssumeRole ...`

## Key commits in this phase

Core verified units:
- `d1170ce` `notifications: add customer delivery target and explicit enablement`
- `c920962` `notifications: add one-click customer unsubscribe`
- `f32d793` `notifications: add CloudTrail evidence helper`

Phase transition guard:
- `b72fcf1` `docs: add Option 1 notifications contract`
- `1c7766a` `portal: disable customer portal for Phase 1`

## Rollback notes

If a Phase 1 rollback is required, treat each verified unit separately.

### Notification delivery target / enablement
Revert:
- `d1170ce`

Clean state:
- remove or reset:
  - `notificationEmail`
  - `notificationsEnabled`

Expected effect:
- customer delivery target fields disappear
- customer notifications stop routing by `customerId`

### Unsubscribe
Revert:
- `c920962`

Clean state:
- remove or reset:
  - `notificationUnsubscribeTokenHash`
  - `notificationUnsubscribedAt`
  - `notificationsEnabled`

Expected effect:
- unsubscribe endpoint no longer works
- existing unsubscribe links become invalid

### CloudTrail evidence helper
Revert:
- `f32d793`

Clean state:
- no DDB cleanup required

Expected effect:
- customer email still sends, but without the CloudTrail verification section

## Known follow-ups (not part of Phase 1)

Do not treat these as partially complete Phase 1 work. They are separate future modules:
- per-event notification preferences
- CloudTrail evidence lookup automation / reporting retrieval
- dashboard or reporting UI
- customer portal/customer login reactivation

## Operational note

Portal-related code exists in the repo but is intentionally disabled for Phase 1.
Do not re-enable it as part of Phase 1 notification work.
