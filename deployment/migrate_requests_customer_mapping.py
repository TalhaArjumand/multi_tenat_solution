#!/usr/bin/env python3
"""
Backfill request customer mapping metadata and validate customer approver groups.

Usage examples:
  python deployment/migrate_requests_customer_mapping.py \
    --requests-table requests-xxxx-main \
    --customers-table Customers-xxxx-main \
    --days 30 \
    --dry-run

  python deployment/migrate_requests_customer_mapping.py \
    --requests-table requests-xxxx-main \
    --customers-table Customers-xxxx-main \
    --days 30 \
    --apply
"""

from __future__ import annotations

import argparse
import datetime as dt
from typing import Dict, Iterable, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError


ACTIVE_CUSTOMER_STATUSES = {"active", None}
ESTABLISHED_ROLE_STATUSES = {"established", None}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Populate missing customerId/customerName in recent requests "
            "and validate active customers have approverGroupIds."
        )
    )
    parser.add_argument("--requests-table", required=True, help="DynamoDB requests table name")
    parser.add_argument("--customers-table", required=True, help="DynamoDB customers table name")
    parser.add_argument("--days", type=int, default=30, help="Only evaluate requests created within N days")
    parser.add_argument("--region", default=None, help="AWS region (optional)")
    parser.add_argument("--profile", default=None, help="AWS profile (optional)")
    parser.add_argument("--apply", action="store_true", help="Apply updates")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    return parser.parse_args()


def is_active_established_customer(customer: Dict) -> bool:
    return (
        customer.get("status") in ACTIVE_CUSTOMER_STATUSES
        and customer.get("roleStatus") in ESTABLISHED_ROLE_STATUSES
    )


def parse_iso_datetime(value: Optional[str]) -> Optional[dt.datetime]:
    if not value:
        return None
    try:
        # Handles AWSDateTime like 2026-03-02T10:00:00Z
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def build_customer_index(customers: Iterable[Dict]) -> Dict[str, List[Dict]]:
    by_account: Dict[str, List[Dict]] = {}
    for customer in customers:
        for account_id in customer.get("accountIds", []) or []:
            key = str(account_id).strip()
            if not key:
                continue
            by_account.setdefault(key, []).append(customer)
    return by_account


def scan_table(table) -> List[Dict]:
    items: List[Dict] = []
    params = {}
    while True:
        page = table.scan(**params)
        items.extend(page.get("Items", []))
        lek = page.get("LastEvaluatedKey")
        if not lek:
            break
        params["ExclusiveStartKey"] = lek
    return items


def eligible_request_for_backfill(item: Dict, cutoff: dt.datetime) -> bool:
    if item.get("customerId") and item.get("customerName"):
        return False
    created_at = parse_iso_datetime(item.get("createdAt"))
    if not created_at:
        return False
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=dt.timezone.utc)
    return created_at >= cutoff


def resolve_customer_for_request(
    request_item: Dict, by_account: Dict[str, List[Dict]]
) -> Tuple[Optional[Dict], Optional[str]]:
    account_id = str(request_item.get("accountId", "")).strip()
    if not account_id:
        return None, "missing accountId"
    candidates = [
        c
        for c in by_account.get(account_id, [])
        if is_active_established_customer(c)
    ]
    if not candidates:
        return None, f"no active established customer mapping for account {account_id}"
    if len(candidates) > 1:
        ids = ", ".join(c.get("id", "<unknown>") for c in candidates)
        return None, f"multiple customer matches for account {account_id}: {ids}"
    return candidates[0], None


def main() -> int:
    args = parse_args()
    if args.apply and args.dry_run:
        print("Choose either --apply or --dry-run, not both.")
        return 2

    mode = "apply" if args.apply else "dry-run"
    print(f"Running migration in {mode} mode")

    session_kwargs = {}
    if args.profile:
        session_kwargs["profile_name"] = args.profile
    if args.region:
        session_kwargs["region_name"] = args.region

    session = boto3.Session(**session_kwargs)
    dynamodb = session.resource("dynamodb")
    requests_table = dynamodb.Table(args.requests_table)
    customers_table = dynamodb.Table(args.customers_table)

    now = dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(days=args.days)

    try:
        customers = scan_table(customers_table)
        requests = scan_table(requests_table)
    except ClientError as exc:
        print(f"Failed to scan tables: {exc}")
        return 1

    by_account = build_customer_index(customers)
    active_customers = [c for c in customers if is_active_established_customer(c)]
    missing_approvers = [
        c for c in active_customers if not (c.get("approverGroupIds") or [])
    ]

    candidates = [r for r in requests if eligible_request_for_backfill(r, cutoff)]
    updates = []
    unresolved = []

    for req in candidates:
        customer, reason = resolve_customer_for_request(req, by_account)
        if not customer:
            unresolved.append((req.get("id", "<unknown>"), reason))
            continue

        req_id = req.get("id")
        if not req_id:
            unresolved.append(("<missing id>", "request item has no id"))
            continue

        updates.append(
            {
                "id": req_id,
                "customerId": customer.get("id"),
                "customerName": customer.get("name"),
            }
        )

    print(f"Scanned customers: {len(customers)}")
    print(f"Active+established customers: {len(active_customers)}")
    print(f"Scanned requests: {len(requests)}")
    print(f"Recent requests missing customer mapping (<= {args.days} days): {len(candidates)}")
    print(f"Resolvable updates: {len(updates)}")
    print(f"Unresolved requests: {len(unresolved)}")
    print(f"Active customers with empty approverGroupIds: {len(missing_approvers)}")

    if missing_approvers:
        print("\nCustomers missing approver groups:")
        for c in missing_approvers:
            print(f"- id={c.get('id')} name={c.get('name')}")

    if unresolved:
        print("\nUnresolved requests:")
        for req_id, reason in unresolved:
            print(f"- requestId={req_id}: {reason}")

    if not args.apply:
        print("\nDry run complete. Use --apply to persist updates.")
        return 0

    if not updates:
        print("\nNo updates to apply.")
        return 0

    print("\nApplying updates...")
    failures = 0
    for update in updates:
        try:
            requests_table.update_item(
                Key={"id": update["id"]},
                UpdateExpression="SET customerId = :customerId, customerName = :customerName",
                ExpressionAttributeValues={
                    ":customerId": update["customerId"],
                    ":customerName": update["customerName"],
                },
            )
        except ClientError as exc:
            failures += 1
            print(f"- FAILED requestId={update['id']}: {exc}")

    print(f"Applied updates: {len(updates) - failures}")
    print(f"Failed updates: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
