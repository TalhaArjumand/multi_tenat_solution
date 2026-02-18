# Deployment Guide - Role-Based Customer Onboarding

This guide provides step-by-step instructions for deploying the role-based customer onboarding implementation to CloudIQS MSP.

## Prerequisites

### 1. AWS CLI Configuration
```bash
# Ensure AWS CLI is configured with appropriate credentials
aws configure list

# You should have access to the MSP AWS account (722560225075)
```

### 2. Amplify CLI
```bash
# Install Amplify CLI if not already installed
npm install -g @aws-amplify/cli

# Check Amplify CLI version
amplify --version
```

### 3. SES Configuration
Ensure the sender email is verified in Amazon SES:
```bash
# Verify email address in SES
aws ses verify-email-identity --email-address info@sfproject.com.pk --region us-east-1

# Check verification status
aws ses get-identity-verification-attributes \
  --identities info@sfproject.com.pk \
  --region us-east-1
```

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd /path/to/cloudiqs-msp

# Install frontend dependencies
npm install

# This will install:
# - react-icons@^4.11.0 (for status indicators)
# - All other required packages
```

### Step 2: Deploy GraphQL Schema Changes

```bash
# Deploy API changes (GraphQL schema)
amplify push api

# This will:
# 1. Update the Customers table with new fields
# 2. Create GSI (byInvitationToken) on Customers table
# 3. Regenerate GraphQL queries, mutations, and subscriptions
# 4. Update AppSync API

# Expected output:
# ✔ Successfully pulled backend environment main from the cloud.
# ✔ GraphQL schema compiled successfully.
# ✔ All resources are updated in the cloud
```

**Verification:**
```bash
# Verify Customers table has new fields
aws dynamodb describe-table \
  --table-name Customers-aulamfydfvg5fmjl4uboxne7du-main \
  --region us-east-1 \
  --query 'Table.AttributeDefinitions'

# Check for invitationToken GSI
aws dynamodb describe-table \
  --table-name Customers-aulamfydfvg5fmjl4uboxne7du-main \
  --region us-east-1 \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`byInvitationToken`]'
```

### Step 3: Deploy Lambda Functions

```bash
# Deploy all Lambda functions
amplify push function

# This will deploy:
# - teamGenerateCloudFormation
# - teamVerifyCustomerRole
# - teamSendCustomerInvitation
# - teamGetInvitationDetails
# - teamApproveInvitation
# - teamRejectInvitation

# Expected output:
# ✔ Successfully built function resources
# ✔ All Lambda functions deployed
```

**Verification:**
```bash
# List all Lambda functions
aws lambda list-functions \
  --region us-east-1 \
  --query 'Functions[?contains(FunctionName, `team`)].FunctionName' \
  --output table

# Check a specific function
aws lambda get-function \
  --function-name teamGenerateCloudFormation \
  --region us-east-1
```

### Step 4: Install Lambda Dependencies

For each Node.js Lambda function, dependencies need to be installed:

```bash
# Navigate to each Lambda function directory and install
cd amplify/backend/function/teamGenerateCloudFormation/src
npm install
cd ../../..

cd amplify/backend/function/teamVerifyCustomerRole/src
npm install
cd ../../..

cd amplify/backend/function/teamSendCustomerInvitation/src
npm install
cd ../../..

cd amplify/backend/function/teamGetInvitationDetails/src
npm install
cd ../../..

cd amplify/backend/function/teamApproveInvitation/src
npm install
cd ../../..

cd amplify/backend/function/teamRejectInvitation/src
npm install
cd ../../../../..
```

### Step 5: Configure Environment Variables

Set environment variables for Lambda functions:

```bash
# Update Lambda environment variables via AWS Console or CLI
aws lambda update-function-configuration \
  --function-name teamSendCustomerInvitation \
  --environment Variables={
    MSP_ACCOUNT_ID=722560225075,
    PORTAL_URL=https://main.d13k6ou0ossrku.amplifyapp.com,
    SENDER_EMAIL=info@sfproject.com.pk,
    INVITATION_EXPIRY_DAYS=7
  } \
  --region us-east-1

aws lambda update-function-configuration \
  --function-name teamGenerateCloudFormation \
  --environment Variables={
    MSP_ACCOUNT_ID=722560225075
  } \
  --region us-east-1
```

### Step 6: Update IAM Permissions

Add AssumeRole permissions to Lambda execution role:

```bash
# Get the Lambda execution role ARN
ROLE_ARN=$(aws lambda get-function-configuration \
  --function-name teamVerifyCustomerRole \
  --region us-east-1 \
  --query 'Role' \
  --output text)

# Extract role name from ARN
ROLE_NAME=$(echo $ROLE_ARN | cut -d'/' -f2)

# Create policy document
cat > assume-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:AssumeRole"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Attach inline policy to role
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name AssumeRolePolicy \
  --policy-document file://assume-role-policy.json
```

### Step 7: Configure API Gateway Endpoints

Create REST API endpoints for public Lambda functions:

```bash
# This step is typically done through Amplify Console or manually
# Alternatively, create an API Gateway using AWS Console:

# 1. Go to API Gateway console
# 2. Create new REST API named "CustomerInvitationAPI"
# 3. Create resources:
#    - /customer-invitation/details (POST)
#    - /customer-invitation/approve (POST)
#    - /customer-invitation/reject (POST)
# 4. Enable CORS for all endpoints
# 5. Deploy to stage "prod"
# 6. Note the invoke URL
```

**Manual API Gateway Setup:**

For `/customer-invitation/details`:
```json
{
  "Integration": {
    "Type": "AWS_PROXY",
    "IntegrationHttpMethod": "POST",
    "Uri": "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:ACCOUNT:function:teamGetInvitationDetails/invocations"
  }
}
```

Repeat for other endpoints.

### Step 8: Set Frontend Environment Variables

Create `.env` file in the project root:

```bash
cat > .env << EOF
REACT_APP_API_URL=https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/prod
EOF
```

### Step 9: Build and Deploy Frontend

```bash
# Build React application
npm run build

# Deploy to Amplify Hosting
amplify publish

# Expected output:
# ✔ Build completed successfully
# ✔ Successfully published to https://main.d13k6ou0ossrku.amplifyapp.com
```

### Step 10: Verification Testing

#### Test 1: Create Customer
1. Log in to CloudIQS MSP portal
2. Navigate to Admin > Customers
3. Click "Create customer"
4. Fill in details:
   - Customer Name: "Test Corp"
   - Admin Email: your-email@example.com
   - Permission Set: "Read-Only"
5. Submit
6. Verify customer appears in list with "Pending Approval" status

#### Test 2: Check Database
```bash
# Query customer in DynamoDB
aws dynamodb scan \
  --table-name Customers-aulamfydfvg5fmjl4uboxne7du-main \
  --region us-east-1 \
  --filter-expression "attribute_exists(roleStatus)" \
  --limit 5
```

#### Test 3: Approval Page
1. Navigate to `/customer-approval?token=YOUR_INVITATION_TOKEN`
2. Verify customer details load
3. Click "Approve Request"
4. Download CloudFormation template
5. Verify template content

#### Test 4: Role Verification
```bash
# Manually trigger role verification Lambda
aws lambda invoke \
  --function-name teamVerifyCustomerRole \
  --payload '{"customerId":"CUSTOMER_ID","roleArn":"arn:aws:iam::ACCOUNT:role/CloudIQS-MSP-AccessRole","externalId":"EXTERNAL_ID"}' \
  --region us-east-1 \
  response.json

cat response.json
```

## Post-Deployment Configuration

### 1. Enable CloudWatch Logs
Ensure all Lambda functions have CloudWatch Logs enabled:
```bash
# Check log groups
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/team \
  --region us-east-1
```

### 2. Set Up CloudWatch Alarms
Create alarms for critical errors:
```bash
# Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name "CustomerOnboarding-Errors" \
  --alarm-description "Alert on customer onboarding errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --region us-east-1
```

### 3. Configure SES Production Access
If using SES sandbox, request production access:
```bash
# Check current sending limits
aws sesv2 get-account --region us-east-1

# Request production access through AWS Console:
# SES > Account Dashboard > Request production access
```

## Rollback Procedure

If issues arise, rollback using:

```bash
# Rollback to previous Amplify environment
amplify env checkout previous

# Or restore specific resources
amplify restore api
amplify restore function
```

## Troubleshooting

### Issue: Lambda function deployment fails
```bash
# Check Amplify backend status
amplify status

# View detailed errors
amplify push --verbose
```

### Issue: GraphQL schema update fails
```bash
# Validate schema syntax
amplify api gql-compile

# Check for naming conflicts
amplify console api
```

### Issue: Frontend build fails
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

### Issue: Can't send emails
```bash
# Verify SES email
aws ses get-identity-verification-attributes \
  --identities info@sfproject.com.pk \
  --region us-east-1

# Check SES sending limits
aws sesv2 get-account --region us-east-1

# Test send email
aws ses send-email \
  --from info@sfproject.com.pk \
  --to test@example.com \
  --subject "Test" \
  --text "Test email" \
  --region us-east-1
```

## Monitoring

### CloudWatch Dashboard
Create a dashboard to monitor:
- Lambda invocations
- Lambda errors
- API Gateway requests
- DynamoDB operations

### Log Analysis
Key logs to monitor:
```bash
# Customer creation logs
aws logs tail /aws/lambda/teamCreateCustomer --follow

# Invitation sending logs
aws logs tail /aws/lambda/teamSendCustomerInvitation --follow

# Role verification logs
aws logs tail /aws/lambda/teamVerifyCustomerRole --follow
```

## Security Checklist

- [ ] SES sender email verified
- [ ] Lambda functions have minimal IAM permissions
- [ ] API Gateway endpoints use CORS correctly
- [ ] Invitation tokens are cryptographically secure
- [ ] ExternalId is properly validated
- [ ] CloudWatch logs are enabled
- [ ] Error messages don't leak sensitive information
- [ ] Frontend environment variables are set correctly

## Next Steps

1. **Test End-to-End Flow**: Complete a full customer onboarding
2. **Monitor for 24 Hours**: Watch CloudWatch logs for errors
3. **User Acceptance Testing**: Have MSP admins test the workflow
4. **Documentation**: Share ROLE_BASED_ONBOARDING.md with team
5. **Training**: Train MSP staff on new onboarding process

## Support

For deployment issues:
1. Check CloudWatch Logs for error details
2. Review Amplify Console for deployment status
3. Verify all environment variables are set
4. Contact CloudIQS MSP support team

## Appendix: Manual Testing Checklist

### Admin Portal Tests
- [ ] Create customer with read-only permission
- [ ] Create customer with admin permission
- [ ] Edit existing customer
- [ ] View customer list with role status
- [ ] Delete customer

### Approval Page Tests
- [ ] Access with valid token
- [ ] Access with invalid token
- [ ] Access with expired token
- [ ] Approve invitation
- [ ] Reject invitation
- [ ] Download CloudFormation template

### Access Request Tests
- [ ] Create request for established customer
- [ ] Verify only established customers shown
- [ ] Complete access request flow

### Error Handling Tests
- [ ] Invalid email format
- [ ] Expired invitation
- [ ] Failed role verification
- [ ] Network errors
