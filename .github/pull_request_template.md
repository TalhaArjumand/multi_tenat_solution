## Summary

- What changed:
- Why:

## Model B Merge Gate (Required)

Reference: `docs/MODEL_B_INVARIANTS.md`

Mark each item and link evidence (code location, test, or log proof).

- [ ] 1. Customer-scoped account selection is preserved (`Customers.accountIds` drives request account options).
Evidence:

- [ ] 2. Customer runtime logic does not depend on AWS Organizations APIs (request/approval/grant paths).
Evidence:

- [ ] 3. `mt-*` approval resolves only from `Customers.approverGroupIds`.
Evidence:

- [ ] 4. `mt-*` grant/revoke remains MT-only (AssumeRole/broker), no SSO assignment path.
Evidence:

- [ ] 5. Any Organizations code changed in this PR is admin diagnostics only and isolated from runtime decisions.
Evidence:

## Tests and Validation

- [ ] Unit tests added/updated (or N/A with reason):
- [ ] Integration tests added/updated (or N/A with reason):
- [ ] Manual E2E evidence attached for Model B golden path:

### E2E Evidence (Model B)

- Request payload evidence (`customerId`, `accountId`, `roleId=mt-*`):
- Approval evidence (customer approver groups evaluated):
- Grant path evidence (MT path selected, no SSO assignment):
- Active access evidence (CloudIQS console link/credentials):
- Revoke/expiry evidence:

## Risk and Rollback

- Risk level (low/medium/high):
- Rollback steps:
- Data migration/cleanup required:
