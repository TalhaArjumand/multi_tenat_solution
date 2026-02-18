# CloudIQS MSP Customer Onboarding - Role-Based Trust Implementation

## Overview

This document describes the role-based trust relationship implementation for customer onboarding in CloudIQS MSP. This new approach replaces AWS Organization invitations with IAM role trust relationships, allowing customers to maintain control of their AWS organizations while granting secure, temporary access to MSP operators.

## Architecture

### Identity Broker Pattern

The implementation uses the **identity broker pattern** with IAM role trust relationships instead of organization membership:

1. **MSP Admin** creates a customer and selects a permission set (read-only/admin/custom)
2. **System** generates a secure CloudFormation template with:
   - IAM role with appropriate policies
   - Trust relationship to MSP account
   - ExternalId for additional security
3. **Customer** receives an email invitation with approval link
4. **Customer** approves and downloads the CloudFormation template
5. **Customer** deploys the template in their AWS account
6. **System** automatically verifies the role via AssumeRole
7. **MSP Operators** can request temporary access using AssumeRole

## New Database Schema Fields

The `Customers` type in GraphQL schema has been extended with 13 new fields:

| Field | Type | Purpose |
|-------|------|---------|
| `permissionSet` | String | Permission level: "read-only", "admin", or "custom" |
| `roleStatus` | String | Onboarding progress: "pending_approval", "approved", "established", "rejected", "verification_failed" |
| `roleArn` | String | Customer's IAM role ARN (e.g., arn:aws:iam::123456789012:role/CloudIQS-MSP-AccessRole) |
| `externalId` | String | Unique security token for AssumeRole (UUID v4) |
| `cloudFormationTemplate` | String | Full CloudFormation YAML template |
| `invitationToken` | String | Secure 32-byte token for approval URL |
| `invitationSentAt` | AWSDateTime | When invitation email was sent |
| `invitationExpiresAt` | AWSDateTime | Invitation expiry (7 days after sending) |
| `approvedAt` | AWSDateTime | When customer approved in portal |
| `roleEstablishedAt` | AWSDateTime | When role was verified via AssumeRole |
| `lastRoleVerification` | AWSDateTime | Last successful verification timestamp |
| `roleVerificationError` | String | Error message if verification fails |

**Note:** A Global Secondary Index (GSI) `byInvitationToken` is added to enable querying by invitation token.

## Lambda Functions

### Core Functions

#### 1. teamGenerateCloudFormation
**Purpose:** Generates CloudFormation templates based on permission set

**Input:**
```json
{
  "customerId": "customer-uuid",
  "customerName": "Acme Corp",
  "permissionSet": "read-only",
  "externalId": "uuid-v4"
}
```

**Output:**
```json
{
  "statusCode": 200,
  "body": {
    "customerId": "customer-uuid",
    "customerName": "Acme Corp",
    "permissionSet": "read-only",
    "cloudFormationTemplate": "AWSTemplateFormatVersion: ..."
  }
}
```

**CloudFormation Template Structure:**
- Creates IAM role named `CloudIQS-MSP-AccessRole`
- Trust policy allows MSP account (722560225075) to assume role
- Requires ExternalId for additional security
- Attaches managed policies based on permission set:
  - `read-only`: ReadOnlyAccess
  - `admin`: AdministratorAccess
  - `custom`: ReadOnlyAccess (to be customized)

#### 2. teamVerifyCustomerRole
**Purpose:** Verifies customer IAM role via AssumeRole test

**Input:**
```json
{
  "customerId": "customer-uuid",
  "roleArn": "arn:aws:iam::123456789012:role/CloudIQS-MSP-AccessRole",
  "externalId": "uuid-v4"
}
```

**Process:**
1. Attempts to assume the customer's role
2. Updates customer record with verification status
3. Sets `roleStatus` to "established" on success
4. Sets `roleStatus` to "verification_failed" on error

**Output:**
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "customerId": "customer-uuid",
    "roleStatus": "established",
    "accountId": "123456789012",
    "verifiedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 3. teamSendCustomerInvitation
**Purpose:** Sends invitation email via SES

**Input:**
```json
{
  "customerId": "customer-uuid",
  "customerName": "Acme Corp",
  "adminEmail": "admin@acme.com",
  "adminName": "John Doe",
  "invitationToken": "32-byte-hex-token",
  "permissionSet": "read-only"
}
```

**Email Contains:**
- Organization name and permission level
- Approval link: `https://portal-url/customer-approval?token={invitationToken}`
- Expiration date (7 days from sending)
- Security notes and next steps

### API Endpoint Functions

#### 4. teamGetInvitationDetails
**Endpoint:** `POST /customer-invitation/details`
**Auth:** Public (token-based)

Retrieves customer details by invitation token. Validates expiration and status.

#### 5. teamApproveInvitation
**Endpoint:** `POST /customer-invitation/approve`
**Auth:** Public (token-based)

Approves invitation, generates CloudFormation template, updates customer status to "approved".

#### 6. teamRejectInvitation
**Endpoint:** `POST /customer-invitation/reject`
**Auth:** Public (token-based)

Rejects invitation, updates customer status to "rejected".

## Frontend Components

### 1. RoleStatusIndicator
**Location:** `src/components/Admin/RoleStatusIndicator.js`

Visual status indicator showing current onboarding progress:

| Status | Badge | Icon | Tooltip |
|--------|-------|------|---------|
| pending_approval | Warning | Clock | Waiting for customer approval |
| approved | Info | Spinner | Customer approved - awaiting CloudFormation deployment |
| established | Success | Check Circle | Role verified and ready |
| rejected | Error | Times Circle | Customer rejected invitation |
| verification_failed | Error | Exclamation Triangle | Role verification failed |

### 2. CustomerApprovalPage
**Location:** `src/components/CustomerApproval/CustomerApprovalPage.js`
**Route:** `/customer-approval?token={invitationToken}`
**Auth:** Public (no authentication required)

Multi-step approval workflow:

**Step 1: Review & Approve**
- Displays customer details and permission level
- Shows expiration warning if < 2 days remaining
- Approve or Reject buttons

**Step 2: Download CloudFormation**
- Downloads YAML template
- Filename: `cloudiqs-msp-role-{customer-name}.yaml`

**Step 3: Deploy Instructions**
- Step-by-step guide for CloudFormation deployment
- Lists all AWS Console actions needed

**Step 4: Verification**
- Informs customer about automatic verification
- Shows confirmation when role is established

### 3. Customers.js Updates
**Location:** `src/components/Admin/Customers.js`

**New Features:**
- Permission Set selector in Create Customer modal (dropdown: read-only/admin/custom)
- Role Status column in customer list table
- Automatic generation of `externalId` and `invitationToken` on customer creation
- Customer creation now sets `roleStatus` to "pending_approval"

**Create Customer Flow:**
1. Admin fills in customer details
2. Selects permission set
3. On submit:
   - Generates UUID for `externalId`
   - Generates 32-byte random `invitationToken`
   - Sets `roleStatus` to "pending_approval"
   - Creates customer record
   - (Future: Triggers invitation email via Lambda)

### 4. Request.js Updates
**Location:** `src/components/Requests/Request.js`

**Filter Logic:**
- Only shows customers with `roleStatus === 'established'`
- Allows legacy customers without `roleStatus` field (backward compatibility)
- Ensures operators can only request access to verified customer accounts

## Deployment Steps

### 1. Schema Changes
```bash
# Deploy updated GraphQL schema
amplify push api

# This will:
# - Update Customers table with new fields
# - Create GSI for invitationToken
# - Regenerate GraphQL operations
```

### 2. Lambda Functions
```bash
# Deploy new Lambda functions
amplify push function

# This will deploy:
# - teamGenerateCloudFormation
# - teamVerifyCustomerRole
# - teamSendCustomerInvitation
# - teamGetInvitationDetails
# - teamApproveInvitation
# - teamRejectInvitation
```

### 3. Environment Variables
Configure the following environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| MSP_ACCOUNT_ID | 722560225075 | MSP AWS account ID for trust relationship |
| PORTAL_URL | https://main.d13k6ou0ossrku.amplifyapp.com | Portal URL for approval links |
| SENDER_EMAIL | info@sfproject.com.pk | SES verified sender email |
| REGION | us-east-1 | AWS region |

### 4. IAM Permissions
Ensure Lambda execution role has:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:AssumeRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5. API Gateway Configuration
**Required Endpoints:**

| Method | Path | Lambda | Auth |
|--------|------|--------|------|
| POST | /generate-cloudformation | teamGenerateCloudFormation | Cognito |
| POST | /send-customer-invitation | teamSendCustomerInvitation | Cognito |
| POST | /customer-invitation/details | teamGetInvitationDetails | None |
| POST | /customer-invitation/approve | teamApproveInvitation | None |
| POST | /customer-invitation/reject | teamRejectInvitation | None |
| POST | /verify-customer-role | teamVerifyCustomerRole | Cognito |

**CORS Configuration:**
Enable CORS for customer-invitation endpoints (public access required).

### 6. Frontend Dependencies
```bash
# Install required dependencies
npm install react-icons@^4.11.0
```

## Testing Plan

### Unit Tests

#### Customer Creation
1. Create customer with permission set
2. Verify `externalId` is UUID format
3. Verify `invitationToken` is 32-byte hex string
4. Verify `roleStatus` is "pending_approval"

#### CloudFormation Generation
1. Test read-only template generation
2. Test admin template generation
3. Test custom template generation
4. Verify ExternalId in trust policy
5. Verify role name is "CloudIQS-MSP-AccessRole"

#### Role Verification
1. Test successful AssumeRole
2. Test failed AssumeRole (invalid role)
3. Test failed AssumeRole (invalid ExternalId)
4. Verify customer record updates

### Integration Tests

#### Onboarding Flow
1. Admin creates customer
2. Verify invitation email sent
3. Customer accesses approval page
4. Customer approves
5. Download CloudFormation template
6. Deploy template in test account
7. Verify automatic role verification
8. Verify `roleStatus` changes to "established"

#### Access Request Flow
1. Operator creates access request
2. Verify only "established" customers shown
3. Select customer with established role
4. Submit request
5. Verify AssumeRole called with correct ExternalId
6. Verify temporary credentials returned

## Security Considerations

### 1. ExternalId
- Generated as UUID v4 for uniqueness
- Stored in customer record
- Required in all AssumeRole calls
- Prevents confused deputy problem

### 2. Invitation Tokens
- 32-byte cryptographically secure random string
- Single-use (implicitly through approval status)
- 7-day expiration
- Transmitted via HTTPS only

### 3. Role Trust Policy
```yaml
AssumeRolePolicyDocument:
  Version: '2012-10-17'
  Statement:
    - Effect: Allow
      Principal:
        AWS: arn:aws:iam::722560225075:root
      Action: sts:AssumeRole
      Condition:
        StringEquals:
          sts:ExternalId: {ExternalId}
```

### 4. Email Security
- SES sender verification required
- DKIM/SPF recommended
- Email contains approval link only (no sensitive data)

### 5. Audit Logging
All operations logged:
- Customer creation
- Invitation sending
- Approval/Rejection
- Role verification attempts
- AssumeRole operations

## Migration from Organization-Based Onboarding

### For Existing Customers
1. Existing customers without `roleStatus` field are treated as legacy
2. They continue to work with organization-based access
3. Gradual migration recommended:
   - Send invitation to existing customers
   - Once role established, update `roleStatus`
   - Old organization membership can be maintained during transition

### Backward Compatibility
- Request.js filters allow customers without `roleStatus`
- All new customers use role-based onboarding
- Legacy customers can be migrated on-demand

## Troubleshooting

### Common Issues

#### 1. Invitation Email Not Received
**Symptoms:** Customer doesn't receive invitation email
**Causes:**
- SES sender not verified
- Email in spam folder
- Invalid email address

**Resolution:**
1. Verify SES sender email in AWS Console
2. Check CloudWatch logs for teamSendCustomerInvitation
3. Resend invitation manually

#### 2. Role Verification Failed
**Symptoms:** Role status stays "approved" instead of "established"
**Causes:**
- Customer hasn't deployed CloudFormation
- Incorrect ExternalId in template
- IAM role name mismatch
- Trust policy incorrect

**Resolution:**
1. Check CloudWatch logs for teamVerifyCustomerRole
2. Verify CloudFormation stack status in customer account
3. Verify role name is "CloudIQS-MSP-AccessRole"
4. Verify ExternalId matches customer record
5. Manually trigger verification via admin panel

#### 3. Access Request Fails
**Symptoms:** AssumeRole fails when granting access
**Causes:**
- Role not established
- Incorrect ExternalId
- Role deleted in customer account
- Trust policy modified

**Resolution:**
1. Re-verify role status
2. Check customer's IAM role still exists
3. Verify trust policy hasn't been modified
4. Re-deploy CloudFormation if necessary

## Future Enhancements

### Phase 2 (Access Request Integration)
- Update teamRouter Lambda to use AssumeRole
- Add ExternalId validation in access grant logic
- Comprehensive error handling for AssumeRole failures

### Phase 3 (Scheduled Verification)
- teamScheduledRoleVerification Lambda (daily)
- Verifies all "established" roles still accessible
- Alerts on verification failures
- Updates `lastRoleVerification` timestamp

### Phase 4 (Advanced Features)
- Custom permission set editor
- Role rotation support
- Multi-account customer support
- Detailed audit trail UI

## Support

For issues or questions:
1. Check CloudWatch Logs for Lambda errors
2. Review customer record in DynamoDB
3. Contact CloudIQS MSP support team

## References

- [AWS IAM Temporary Elevated Access Broker](https://github.com/aws-samples/aws-iam-temporary-elevated-access-broker)
- [AWS AssumeRole Documentation](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
- [CloudFormation IAM Role Documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html)
- [SES Email Sending](https://docs.aws.amazon.com/ses/latest/dg/send-email.html)
