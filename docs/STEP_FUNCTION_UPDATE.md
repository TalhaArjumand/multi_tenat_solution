# Step Function Update for Multi-Tenant Support

## Overview

The Grant and Revoke Step Functions have been updated to support a dual-path flow: SSO (existing) and Multi-Tenant (new). These changes are fully integrated into the Amplify CloudFormation template and deploy automatically via `amplify push` or CI/CD pipeline — no manual AWS console changes required.

## What Changed

### Files Modified
- **`amplify/backend/custom/stepfunctions/stepfunctions-cloudformation-template.json`** — Grant SM definition updated with dual-path, Revoke SM updated with multi-tenant branch, IAM role updated with Lambda invoke permission, new parameter for `teamMultiTenantGrant` ARN
- **`amplify/backend/backend-config.json`** — Added `teamMultiTenantGrant` as a dependency of the `stepfunctions` custom resource

### Grant State Machine — New Flow
1. **CheckMultiTenant** — Invokes `teamMultiTenantGrant` Lambda (via `lambda:invoke`) which checks if the request's `roleId` starts with `mt-`
2. **IsMultiTenant** — Choice state that branches based on `$.isMultiTenant` from the Lambda response
3. If `true` → Skips SSO `CreateAccountAssignment`, goes directly to `Update Request Status - in progress`
4. If `false` (or if CheckMultiTenant fails) → Uses existing SSO `CreateAccountAssignment` flow (`Grant Permission`)
5. Both paths converge at `Update Request Status - in progress` → `Notify Started` → `Wait` → `Revoke Permission`

### Revoke State Machine — New Flow
- Added `CheckRevokeType` choice state before `Revoke Permission`
- If `$.isMultiTenant == true` → `MultiTenantRevoke` (Pass state, STS credentials auto-expire)
- If `false` → Existing SSO `DeleteAccountAssignment` flow
- Both paths converge at `Notify Requester Session Ended`

## Deployment

These changes deploy automatically when you push to CodeCommit and Amplify builds. No manual steps required.

Alternatively, run `amplify push` locally to deploy.
