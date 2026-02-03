# MSP Multi-Customer Quick Reference

## Customer Management

### Create a Customer
1. Admin → Customers → "Create customer"
2. Enter: Name, Description, Admin contact
3. Select: AWS accounts, Approver groups
4. Status: Active/Inactive
5. Click "Create customer"

### Edit a Customer
1. Admin → Customers
2. Select customer → "Edit"
3. Modify: Accounts, Approvers, Status
4. Click "Save changes"

### Delete a Customer
1. Admin → Customers
2. Select customer(s) → "Delete"
3. Confirm deletion
Note: Deleting a customer doesn't delete AWS accounts, only the customer record.

## Request Workflow with Customers

### As a Requester
1. Requests → "Create request"
2. Select account (customer name auto-displays if assigned)
3. Complete form (role, duration, justification, ticket)
4. Submit

### As an Approver
1. Approvals → "Approve requests"
2. View "Customer" column to identify organization
3. Review and Approve/Reject

### As an Auditor
1. Audit → "Elevated access" or "Approvals"
2. Use "Customer" column to filter/sort
3. Export to CSV (includes customer data)

## Customer Field Locations

Customer information appears in:
- **Request form**: Shows customer when account selected
- **My requests table**: Customer column
- **Approve requests table**: Customer column
- **Audit approvals table**: Customer column
- **Audit sessions table**: Customer column

## Common Tasks

### Onboard New Customer
```
1. Create customer record with name/contact
2. Assign their AWS account IDs
3. Assign approver groups (IAM Identity Center groups)
4. Set status to "Active"
5. Create eligibility policies for their users
```

### Customer Access Review
```
1. Audit → "Elevated access"
2. Sort by "Customer" column
3. Filter to specific customer name
4. Export to CSV for records
```

### Reassign Account to Different Customer
```
1. Admin → Customers → Edit old customer
2. Remove account from accountIds list
3. Save
4. Admin → Customers → Edit new customer
5. Add account to accountIds list
6. Save
```

### Offboard Customer
```
Option 1 (Soft delete):
1. Admin → Customers → Edit customer
2. Set Status to "Inactive"
3. Save

Option 2 (Hard delete):
1. Admin → Customers → Select customer
2. Click "Delete"
3. Confirm
Note: Historical requests retain customer data
```

## GraphQL Examples

### List Customers
```graphql
query {
  listCustomers {
    items {
      id
      name
      accountIds
      status
    }
  }
}
```

### Get Customer by ID
```graphql
query {
  getCustomers(id: "customer-uuid") {
    name
    accountIds
    approverGroupIds
    adminEmail
  }
}
```

### Create Customer
```graphql
mutation {
  createCustomers(input: {
    name: "Acme Corp"
    description: "Main customer"
    accountIds: ["123456789012", "234567890123"]
    approverGroupIds: ["group-id-1"]
    adminEmail: "admin@acme.com"
    status: "active"
    modifiedBy: "admin@example.com"
  }) {
    id
    name
  }
}
```

## Customer Data Model

```javascript
{
  "id": "uuid",                    // Auto-generated
  "name": "Acme Corporation",      // Required
  "description": "...",            // Optional
  "accountIds": ["123...", "456..."],  // Array of AWS account IDs
  "approverGroupIds": ["g1", "g2"],    // IAM IdC group IDs
  "adminEmail": "admin@acme.com",  // Optional
  "adminName": "John Doe",         // Optional
  "status": "active",              // active | inactive
  "createdAt": "2024-01-01T00:00:00Z",
  "modifiedBy": "admin@example.com"
}
```

## Troubleshooting

**Q: Customer not showing in request?**
A: Verify account is in customer's accountIds array and status is "active"

**Q: Wrong approvers seeing requests?**
A: Check customer's approverGroupIds match IAM IdC group memberships

**Q: Can't delete customer?**
A: Ensure you're an Admin. CustomerAdmin can only view, not delete.

**Q: Old requests show "-" for customer?**
A: Expected. Customer tagging is forward-only (new requests after implementation)

## Keyboard Shortcuts

- Customers page: `Ctrl/Cmd + K` - Search/filter
- Create customer: Click "Create customer" button (no shortcut)
- Export audit logs: Click "Export to CSV" (includes customer column)

## Best Practices

✅ **DO:**
- Create customers before assigning accounts
- Use full organization names
- Keep admin contact info current
- Set to inactive rather than delete when offboarding
- Export customer-specific audit logs regularly

❌ **DON'T:**
- Delete customers with active sessions
- Assign same account to multiple customers
- Use generic names like "Customer 1"
- Forget to assign approver groups
- Mix personal and customer accounts

## Integration Points

### With IAM Identity Center
- Customer approver groups map to IdC groups
- User eligibility still controlled via IdC + eligibility policies
- Customer context adds metadata layer on top

### With CloudTrail
- Sessions tagged with customer info
- CloudTrail logs queryable by customer
- Full audit trail maintained per customer

### With Existing TEAM Features
- Approver policies: Work alongside customer approvers
- Eligibility policies: Can optionally tag with customer
- Settings: Apply globally across all customers
- Notifications: Include customer context in emails

## API Endpoints

All customer operations use the AppSync GraphQL API:

```
Endpoint: [Your-AppSync-API-URL]
Auth: Cognito User Pools (Admin/CustomerAdmin groups)

Operations:
- listCustomers
- getCustomers(id)
- createCustomers(input)
- updateCustomers(input)
- deleteCustomers(input)
```

## Security Notes

- Customer data stored in your AWS account only
- No cross-customer data leakage (logical isolation)
- Admins see all customers
- CustomerAdmin role can view but not modify
- Approvers see only assigned customer requests (future enhancement)

## Support

- Documentation: [MSP_SETUP_GUIDE.md](MSP_SETUP_GUIDE.md)
- Issues: GitHub repository
- Original TEAM docs: https://aws-samples.github.io/iam-identity-center-team/
