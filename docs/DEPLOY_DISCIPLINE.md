# Deploy Discipline

## Purpose

This document defines how changes are grouped, verified, and deployed in this repo.

The goal is to reduce unnecessary deploy cost and time without losing clarity, rollback safety, or production confidence.

## Core Rule

Deploy only when a **deploy unit** is ready.

A deploy unit is:

- one coherent behavior change
- locally verified before push
- small enough to explain and verify after deploy

Examples:

- Gate-3 backend approval hardening
- Request form MT customer validation
- Eligibility hydration fix
- Migration logging instrumentation

## What Does Not Define a Deploy Unit

These do **not** determine deploy scope on their own:

- one file changed
- many files changed
- frontend vs backend only

AWS cost and deploy risk are driven more by:

- how often builds and deploys run
- which cloud resources change
- how much runtime traffic/execution occurs

## Pre-Deploy Gates

Before every deploy unit:

1. Confirm the staged diff matches one coherent change.
2. Run the smallest relevant local verification.
3. Keep unrelated local changes out of the deploy.

Typical checks:

- frontend change: `npm run build`
- python lambda change: `python3 -m py_compile path/to/index.py`
- sanity check: `git diff --cached --stat`

## Deployment Rules

- Deploy security gating changes as isolated units when possible.
- Do not mix unrelated refactors with runtime behavior changes.
- Keep generated file churn out unless it is explicitly part of the deploy unit.
- Push only after local verification passes.

## Post-Deploy Verification

Every deploy unit must have a minimal live verification checklist.

Examples:

- MT request creates successfully
- missing customer approvers are denied explicitly
- approval inbox shows the request correctly
- CloudWatch log event appears

If there is no clear post-deploy check, the deploy unit is underspecified.

## Cost-Control Rule

Do not deploy every local improvement immediately.

Deploy now only if the change:

- fixes a user-visible bug
- closes a security gap
- unblocks the next implementation step

Otherwise, batch until a real deploy unit is ready.

## Git Discipline

- Commit one deploy unit at a time.
- Keep backup and deploy remotes in sync after verification.
- Do not include unrelated dirty files in a deploy commit.

Recommended pattern:

1. verify locally
2. stage only intended files
3. commit one deploy unit
4. push to deploy remote
5. push to backup remote
6. verify live behavior

## Decision Rule

Use this test before pushing:

Can I describe this deploy in one sentence, explain why it is safe, and verify it with one short live checklist?

If not, do not deploy it yet.
