# Rollback Checkpoint 2026-03-06

## Baseline

- Last known-good runtime baseline restored to commit `4fdea48` (`requests view: show live request statuses`)
- Rollback commit created and pushed: `b08aee3` (`revert: restore deployment-40 runtime baseline`)
- Remotes updated:
  - `codecommit/main`
  - `backup/main`

## Git Changes Rolled Back

The following commits were reverted to return `main` to the deployment-40 baseline:

1. `a81302a` `active access: restrict status filter options`
2. `c93bf93` `requests: persist and show failure reasons`
3. `03d3671` `requests: allow missing start time on failed rows`
4. `a25ee64` `ci: gate amplify backend build behind RUN_BACKEND`
5. `ae613cc` `ci: make amplify hosting frontend-only`
6. `ec05e99` `ci: include aws exports for frontend-only hosting`

## Amplify Console Restored

- Restored the original backend + frontend build specification in Amplify Hosting
- Removed temporary Hosting environment variables:
  - `RUN_BACKEND`
  - `AMPLIFY_SKIP_BACKEND_BUILD`
- Kept `AMPLIFY_BACKEND_APP_ID`

## Manual AWS Rollback / Repairs

These changes were applied live in AWS and are not represented by a new Git commit in this checkpoint.

### AppSync

- Rolled back the live AppSync schema to the deployment-40 shape
- Removed post-baseline fields:
  - `statusErrorCode`
  - `statusErrorMessage`
- Restored `requests.startTime` to non-nullable
- Restored the old `MutationupdateRequestsinit0Function` input whitelist

### Cognito

- Restored `SupportedIdentityProviders` for both main user-pool clients to include:
  - `IDC`
  - `COGNITO`
- This repaired the `Sign in with AWS` login path

### MT Credentials IAM

- Restored DynamoDB read permissions on `teamLambdaRoleMTCreds-main`
- Added back access required for:
  - `requests-*`
  - `Customers-*`
- This repaired `Console` and `CLI Creds` for active multi-tenant access

## Verified Working State

At the end of the rollback and live repairs:

- App loads normally
- Login works normally
- Authenticated shell renders
- Request form opens
- Active access `Console` works
- Active access `CLI Creds` works

## Working Repo

Use this repo for future changes:

- `/Users/njap/Downloads/steve_work/cloudiqs-msp-clean`

Verified state:

- `HEAD = b08aee3c5711ecb1511d0a63f841bbe1dd0734ec`
- clean working tree
- aligned with `codecommit/main`

## Old Repo

Do not use this repo for new work:

- `/Users/njap/Downloads/steve_work/cloudiqs-msp`

It remains useful only as an archive / forensic copy because it contains unrelated local drift.

## Follow-Up

The runtime is healthy, but not all live AWS repairs are self-healing yet. Before future feature work, reconcile these live/manual fixes back into source of truth in a controlled unit:

1. Cognito app client identity provider settings
2. MT creds IAM policy shape
3. Any AppSync live/manual rollback details that are not represented in the current repo baseline
