# CloudiQS MSP Multi-Customer Setup Guide

This guide explains how to use the TEAM application for Managed Service Provider (MSP) scenarios with multiple customer organizations.

## Overview

The CloudiQS MSP enhancements extend the TEAM (Temporary Elevated Access Management) application to support:

- **Multi-Customer Management**: Organize AWS accounts by customer organization
- **Customer-Specific Access Control**: Assign approvers per customer
- **Customer Context**: Track which customer each access request belongs to
- **Customer-Scoped Auditing**: Filter audit logs and reports by customer

## Architecture

The MSP implementation adds a `Customers` entity that groups AWS accounts and links them to customer-specific approvers:

```
Customer → AWS Accounts (1:many)
Customer → Approver Groups (1:many)
Request → Customer (via Account, many:1)
```

### Key Features

1. **Customer Table**: Stores customer organization information
2. **Account-Customer Mapping**: Links AWS accounts to customers
3. **Customer Context in Workflows**: Request and approval flows include customer information
4. **Audit Trail**: All access requests and sessions tagged with customer information

## Setup Instructions

### 1. Deploy the Updated Schema

After cloning this repository, deploy the updated GraphQL schema to create the Customers table:

```bash
amplify push
```

This will:
- Create the `Customers` DynamoDB table
- Add customer fields to existing tables (requests, sessions, approvers, eligibility)
- Update the GraphQL API

### 2. Create Customer Organizations

As an **Admin** user:

1. Navigate to **Administration → Customers** in the TEAM application
2. Click **"Create customer"**
3. Fill in customer details:
   - **Customer Name**: Organization name (e.g., "Acme Corporation")
   - **Description**: Brief description of the customer
   - **Admin Name**: Primary contact name
   - **Admin Email**: Contact email for customer admin
   - **Status**: Active or Inactive
   - **AWS Accounts**: Select all accounts belonging to this customer
   - **Approver Groups**: Select IAM Identity Center groups that can approve requests for this customer's accounts

4. Click **"Create customer"**

### 3. Assign Accounts to Customers

When creating or editing a customer:
- Use the **AWS Accounts** multiselect to choose all accounts belonging to the customer
- The system will automatically tag requests for these accounts with the customer name

### 4. Configure Customer-Specific Approvers

You can configure approvers in two ways:

#### Option A: Customer-Scoped Approvers (Recommended for MSP)

1. Navigate to **Administration → Customers**
2. Edit the customer
3. In the **Approver Groups** field, select IAM Identity Center groups
4. These groups will be able to approve requests for this customer's accounts

#### Option B: Traditional Account/OU Approvers

Continue using the **Administration → Approver policy** page to configure approvers by account or OU. This works alongside customer-specific approvers.

### 5. Create Customer-Specific Eligibility Policies

1. Navigate to **Administration → Eligibility policy**
2. Create eligibility rules for user groups
3. Optionally add customer context to help organize policies
4. Users will see customer names when selecting accounts in request forms

## User Workflows

### Requesting Access (DevOps User)

1. Navigate to **Requests → Create request**
2. Select an AWS account
   - If the account belongs to a customer, you'll see a **Customer** field showing the organization name
3. Complete the rest of the request form:
   - Role (permission set)
   - Duration (max 1 hour by default)
   - Start time
   - Justification
   - Ticket number
4. Submit the request

The customer information is automatically included in the request.

### Approving Requests (Customer Admin or MSP Approver)

1. Navigate to **Approvals → Approve requests**
2. View pending requests with customer context:
   - The **Customer** column shows which organization the request is for
3. Click on a request to review details
4. Approve or reject based on your approval authority

**Note**: Approvers assigned to specific customers will only see requests for their customers' accounts.

### Auditing Access (Auditor or Customer Admin)

1. Navigate to **Audit → Elevated access** or **Audit → Approvals**
2. View audit logs with customer information:
   - **Customer** column shows the organization for each access session
3. Use the table filter to search by customer name
4. Export audit logs to CSV (includes customer information)

**Future Enhancement**: Customer-specific filtering dropdown for easier navigation.

## Customer Data Structure

### Customers Table Fields

- **id**: Unique customer identifier (auto-generated)
- **name**: Customer organization name (required)
- **description**: Optional description
- **accountIds**: Array of AWS account IDs belonging to this customer
- **approverGroupIds**: Array of IAM Identity Center group IDs that can approve for this customer
- **adminEmail**: Customer admin contact email
- **adminName**: Customer admin contact name
- **status**: "active" or "inactive"
- **createdAt**: Timestamp of customer creation
- **modifiedBy**: User who last modified the customer record

### Enhanced Table Fields

The following tables now include customer context:

**requests table**:
- `customerId`: Customer UUID
- `customerName`: Customer organization name

**sessions table**:
- `customerId`: Customer UUID
- `customerName`: Customer organization name

**approvers table**:
- `customerId`: Optional customer UUID (for customer-specific approvers)
- `customerName`: Optional customer name

**eligibility table**:
- `customerId`: Optional customer UUID (for customer-specific eligibility)
- `customerName`: Optional customer name

## Best Practices

### For MSP Operators

1. **Create customers before onboarding**: Set up the customer record before granting access
2. **Use descriptive names**: Use full organization names for clarity
3. **Maintain contact information**: Keep admin email/name current for notifications
4. **Review regularly**: Periodically audit customer-account mappings
5. **Document changes**: Use the description field to note important details

### For Security and Compliance

1. **Segregate approvers**: Assign different approver groups per customer
2. **Customer isolation**: Verify that customer admins can only approve for their accounts
3. **Audit regularly**: Review customer-scoped audit logs for each organization
4. **Export reports**: Generate CSV exports per customer for compliance reporting
5. **Monitor status**: Set customers to "inactive" when offboarding

### For Customer Admins

1. **Review requests carefully**: Check customer field matches your organization
2. **Understand context**: Use justification and ticket numbers to validate requests
3. **Track access**: Monitor audit logs for your customer's accounts
4. **Report issues**: Contact MSP operator if you see requests for wrong customer

## Backwards Compatibility

The implementation is **fully backwards compatible**:

- Existing accounts without customer assignments will work normally
- Customer fields are optional and default to `null`
- All existing approver and eligibility policies continue to function
- Tables show "-" for accounts without customer assignments

## Security Considerations

### Authorization

The schema includes authorization rules for customer data:

- **Admins**: Full CRUD access to customer records
- **CustomerAdmin group**: Read access to customer records
- **Regular users**: Read access (view customer names in forms)

### Data Privacy

- Customer information is stored within your AWS environment
- No external services are used
- All data follows existing TEAM security patterns
- IAM Identity Center integration provides SSO and MFA

### Multi-Tenancy Isolation

The current implementation provides **logical isolation** through customer tagging:

- Accounts are tagged with customer IDs
- Approvers can be scoped to specific customers
- Audit logs include customer context for filtering

**Note**: This is not hard multi-tenancy. All data resides in the same DynamoDB tables with customer identifiers.

## Troubleshooting

### Customer not showing in request form

**Issue**: Selected account doesn't show customer information

**Solution**:
1. Verify the account is assigned to a customer in **Administration → Customers**
2. Check that the customer status is "active"
3. Refresh the page to load updated data

### Approver can see wrong customer's requests

**Issue**: Approver sees requests they shouldn't approve

**Solution**:
1. Verify approver group assignment in **Administration → Customers**
2. Check account-customer mappings are correct
3. Review **Administration → Approver policy** for account/OU level rules

### Customer field shows "-" in audit logs

**Issue**: Old requests don't have customer information

**Solution**: This is expected. Customer tagging is forward-only. Historical requests before the MSP enhancement won't have customer data.

## API Reference

### GraphQL Queries

```graphql
# List all customers
query ListCustomers {
  listCustomers {
    items {
      id
      name
      description
      accountIds
      approverGroupIds
      adminEmail
      adminName
      status
      createdAt
      modifiedBy
    }
  }
}

# Get a specific customer
query GetCustomer($id: ID!) {
  getCustomers(id: $id) {
    id
    name
    accountIds
    # ... other fields
  }
}
```

### GraphQL Mutations

```graphql
# Create a customer
mutation CreateCustomer($input: CreateCustomersInput!) {
  createCustomers(input: $input) {
    id
    name
  }
}

# Update a customer
mutation UpdateCustomer($input: UpdateCustomersInput!) {
  updateCustomers(input: $input) {
    id
    name
  }
}

# Delete a customer
mutation DeleteCustomer($input: DeleteCustomersInput!) {
  deleteCustomers(input: $input) {
    id
  }
}
```

## Future Enhancements

Potential improvements for future releases:

1. **Customer Admin Portal**: Dedicated view for customer admins to manage only their accounts
2. **Advanced Filtering**: Dropdown filters on audit pages for quick customer selection
3. **Customer-Scoped Exports**: One-click CSV export filtered by customer
4. **Customer Dashboards**: Summary metrics per customer organization
5. **Billing Integration**: Track usage and costs per customer
6. **Notifications**: Customer-specific email notifications for their requests
7. **Customer Settings**: Per-customer approval requirements and duration limits
8. **Hard Multi-Tenancy**: Option to deploy separate stacks per customer for complete isolation

## Support

For issues or questions about the MSP multi-customer implementation:

1. Check this documentation first
2. Review the main TEAM documentation at [https://aws-samples.github.io/iam-identity-center-team/](https://aws-samples.github.io/iam-identity-center-team/)
3. Submit issues to the GitHub repository
4. Contact your AWS account team for enterprise support

## License

This extension follows the same MIT-0 license as the original TEAM application. See LICENSE file for details.
