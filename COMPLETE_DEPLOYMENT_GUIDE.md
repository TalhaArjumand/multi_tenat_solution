# Complete Deployment Guide - TEAM Application with IAM Identity Center

## Your IAM Identity Center Details

Based on your configuration:
```
Instance name: (Your instance)
Identity source: Identity Center directory
Region: us-east-1
Organization ID: o-k3ygpfa9fk
Issuer URL: https://identitycenter.amazonaws.com/ssoins-7223afa5ccc151fe
AWS access portal URL: https://d-90661f7cab.awsapps.com/start
```

## Overview

The TEAM application requires a multi-step deployment process:

1. **Initial CloudFormation Deployment** - Creates Cognito, AppSync, DynamoDB, Lambda functions, and Amplify hosting
2. **IAM Identity Center SAML Integration** - Configures TEAM as a SAML application in Identity Center
3. **Cognito Configuration** - Links Cognito User Pool with Identity Center SAML
4. **Final Setup** - Assigns users/groups and tests

## Step 1: Update Deployment Parameters

Edit the deployment parameters file with your actual values:

```bash
cd /Users/umair/2026/Upwork/Steve/CLOUDIQS-MSP/iam-identity-center-team/deployment
nano parameters.sh
```

Update these values:

```bash
# Your IAM Identity Center Login URL
IDC_LOGIN_URL=https://d-90661f7cab.awsapps.com/start

# AWS Region
REGION=us-east-1

# Your AWS Account ID (where TEAM will be deployed)
TEAM_ACCOUNT=YOUR_ACCOUNT_ID_HERE

# AWS CLI Profile names (configure these first)
ORG_MASTER_PROFILE=default  # Or your organization master account profile
TEAM_ACCOUNT_PROFILE=default  # Or your TEAM account profile

# Group names (create these in Identity Center first)
TEAM_ADMIN_GROUP="team-admins"
TEAM_AUDITOR_GROUP="team-auditors"

# Optional: Tags for resources
TAGS="project=iam-identity-center-team environment=production"

# CloudTrail Lake (if you have one, otherwise use "none")
CLOUDTRAIL_AUDIT_LOGS=none

# Optional: Custom repository secret (if using external repo)
# SECRET_NAME=TEAM-IDC-APP

# Optional: Custom domain (uncomment if you have one)
# UI_DOMAIN=portal.example.com
```

## Step 2: Prerequisites Checklist

Before deploying, ensure you have:

### ✅ AWS Account Setup
- [ ] Dedicated AWS account for TEAM deployment
- [ ] AWS CLI installed and configured
- [ ] AWS credentials with administrator access
- [ ] git-remote-codecommit installed
- [ ] jq installed (for JSON parsing)

### ✅ IAM Identity Center Setup
- [ ] Identity Center enabled in us-east-1
- [ ] Two groups created:
  - `team-admins` (for TEAM administrators)
  - `team-auditors` (for TEAM auditors)
- [ ] Users assigned to these groups

### ✅ AWS CLI Profiles
Configure profiles if not using default:

```bash
# Check current AWS identity
aws sts get-caller-identity

# If you need to configure a profile
aws configure --profile team-account
```

## Step 3: Deploy the CloudFormation Stack

Run the deployment script:

```bash
cd /Users/umair/2026/Upwork/Steve/CLOUDIQS-MSP/iam-identity-center-team/deployment

# Make the script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

This will:
1. Create a CodeCommit repository: `team-idc-app`
2. Push your code to CodeCommit
3. Deploy CloudFormation stack: `TEAM-IDC-APP`
4. Create resources:
   - Cognito User Pool
   - Cognito Identity Pool
   - AppSync GraphQL API
   - DynamoDB tables
   - Lambda functions
   - Amplify App for hosting
   - IAM roles and policies

**Deployment time**: Approximately 15-20 minutes

### Monitor Deployment

Check CloudFormation status:
```bash
aws cloudformation describe-stacks \
  --stack-name TEAM-IDC-APP \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'
```

Wait until status is: `CREATE_COMPLETE`

## Step 4: Get SAML Configuration Parameters

After the CloudFormation stack completes, get the SAML parameters:

```bash
cd /Users/umair/2026/Upwork/Steve/CLOUDIQS-MSP/iam-identity-center-team/deployment
./integration.sh
```

**Expected output** (example):
```bash
applicationStartURL: https://d1s8z5724fsfj7-main.auth.amazoncognito.com/authorize?client_id=2vf6faj4v3t1jdos0misu29i67&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=https://main.d1s8z5724fsfj7.amplifyapp.com/&idp_identifier=team

applicationACSURL: https://d1s8z5724fsfj7-main.auth.amazoncognito.com/saml2/idpresponse

applicationSAMLAudience: urn:amazon:cognito:sp:us-east-1_GXaUCfcno
```

**📋 SAVE THESE VALUES!** You'll need them in the next step.

## Step 5: Configure IAM Identity Center SAML Integration

### 5.1 Add TEAM as a SAML Application

1. Go to **IAM Identity Center Console**: https://console.aws.amazon.com/singlesignon/
2. Navigate to: **Applications** → **Add application**
3. Select **Add custom SAML 2.0 Application**
4. Click **Next**

### 5.2 Configure Application Details

**Display name**: `TEAM IDC APP`

**Description**: `Temporary Elevated Access Management Application`

**📋 IMPORTANT**: Copy and save the **AWS IAM Identity Center SAML metadata file URL** 
- It looks like: `https://portal.sso.us-east-1.amazonaws.com/saml/metadata/[instance-id]`
- You'll need this for Step 6

### 5.3 Application Properties

**Application start URL**: Enter the `applicationStartURL` value from Step 4

Example:
```
https://d1s8z5724fsfj7-main.auth.amazoncognito.com/authorize?client_id=...
```

### 5.4 Application Metadata

Select: **Manually type your metadata values**

**Application ACS URL**: Enter the `applicationACSURL` value from Step 4
```
https://d1s8z5724fsfj7-main.auth.amazoncognito.com/saml2/idpresponse
```

**Application SAML audience**: Enter the `applicationSAMLAudience` value from Step 4
```
urn:amazon:cognito:sp:us-east-1_GXaUCfcno
```

Click **Submit**

### 5.5 Configure Attribute Mappings

1. Click **Actions** → **Edit attribute mappings**
2. Add these mappings:

| User attribute | Maps to | Format |
|---------------|---------|---------|
| Subject | `${user:subject}` | persistent |
| Email | `${user:email}` | basic |

3. Click **Save changes**

### 5.6 Assign Users and Groups

1. Under **Assigned users**, click **Assign users**
2. Add:
   - ✅ `team-admins` group
   - ✅ `team-auditors` group
   - ✅ Any other users/groups who need access to TEAM
3. Click **Assign users**

## Step 6: Update Cognito User Pool Configuration

Now link Cognito with Identity Center SAML:

```bash
cd /Users/umair/2026/Upwork/Steve/CLOUDIQS-MSP/iam-identity-center-team/deployment
./cognito.sh
```

When prompted, enter:
- **SAML metadata URL**: The URL you saved in Step 5.2
- **Identity provider name**: `team` (or your preferred name)

This script will:
1. Configure Cognito User Pool to use Identity Center as SAML IdP
2. Update the identity provider settings
3. Link the SAML metadata

## Step 7: Verify the Deployment

### 7.1 Get the Application URL

```bash
aws amplify list-apps --region us-east-1
```

Look for the app named `TEAM-IDC-APP` and note the default domain:
```
https://main.d[app-id].amplifyapp.com
```

### 7.2 Check Amplify Build Status

```bash
aws amplify list-branches \
  --app-id [your-app-id] \
  --region us-east-1
```

Wait for the build to complete (status: `SUCCEED`)

### 7.3 Get Updated aws-exports.js

After Amplify completes the build, the real `aws-exports.js` will be generated. You can get it from:

```bash
aws amplify get-artifact-url \
  --app-id [your-app-id] \
  --branch-name main \
  --region us-east-1
```

Or simply access the Amplify-hosted application URL.

## Step 8: Test the Application

1. **Open the Application URL** in your browser:
   ```
   https://main.d[app-id].amplifyapp.com
   ```

2. **Click "Federated Sign In"**

3. **You should be redirected to**:
   ```
   https://d-90661f7cab.awsapps.com/start
   ```
   (Your IAM Identity Center login page)

4. **Sign in** with a user that's assigned to the TEAM application

5. **After authentication**, you'll be redirected back to the TEAM application

6. **Verify your role**:
   - If you're in `team-admins` group: You should see admin features
   - If you're in `team-auditors` group: You should see audit features
   - Regular users: Can make requests

## Step 9: Update Local Development Configuration

After deployment, update your local `aws-exports.js` with the real configuration:

```bash
cd /Users/umair/2026/Upwork/Steve/CLOUDIQS-MSP/iam-identity-center-team

# Pull the latest from Amplify
amplify pull
```

This will update your local `src/aws-exports.js` with the real AWS resource IDs.

## Troubleshooting

### Issue: "User not found" after login

**Solution**: Make sure:
1. User is assigned to TEAM application in Identity Center
2. User belongs to one of the groups (team-admins or team-auditors)
3. Groups are properly configured in the parameters.sh file

### Issue: Amplify build fails

**Solution**: Check Amplify console for build logs:
```bash
aws amplify list-jobs \
  --app-id [your-app-id] \
  --branch-name main \
  --region us-east-1
```

### Issue: SAML authentication fails

**Solution**: Verify:
1. SAML metadata URL is correct in Cognito
2. Application ACS URL matches exactly
3. Attribute mappings are configured (Subject and Email)

### Issue: CloudFormation stack fails

**Solution**: Check CloudFormation events:
```bash
aws cloudformation describe-stack-events \
  --stack-name TEAM-IDC-APP \
  --region us-east-1 \
  --max-items 20
```

## Security Notes

🔐 **Important Security Considerations**:
- Never commit `aws-exports.js` to version control (it's in .gitignore)
- Keep your deployment parameters secure
- Use dedicated AWS account for TEAM (not management account)
- Enable CloudTrail Lake for audit logging
- Regularly review user access and permissions
- Follow principle of least privilege

## Post-Deployment Tasks

After successful deployment:

1. ✅ **Configure email notifications** (SES)
2. ✅ **Set up approval workflows**
3. ✅ **Test permission set requests**
4. ✅ **Configure session duration limits**
5. ✅ **Enable audit logging**
6. ✅ **Train admin and auditor users**

## Summary

Your deployment replaces the placeholder configuration with:

**Before (Placeholder)**:
```javascript
"aws_user_pools_id": "us-east-1_PLACEHOLDER",
"oauth": {
  "domain": "placeholder-domain.auth.us-east-1.amazoncognito.com",
  ...
}
```

**After (Real)**:
```javascript
"aws_user_pools_id": "us-east-1_GXaUCfcno",  // Real Cognito User Pool
"oauth": {
  "domain": "d1s8z5724fsfj7-main.auth.us-east-1.amazoncognito.com",  // Real domain
  ...
}
```

The application will then properly authenticate users through your IAM Identity Center!

## Quick Reference Commands

```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name TEAM-IDC-APP --region us-east-1

# Get Amplify app URL
aws amplify list-apps --region us-east-1

# View CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name TEAM-IDC-APP \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'

# Update the application
cd deployment && ./update.sh

# Destroy the application (if needed)
cd deployment && ./destroy.sh
```

## Need Help?

- **Documentation**: See `docs/` folder for detailed guides
- **Architecture**: See `docs/docs/overview/architecture.md`
- **Security**: See `docs/docs/overview/security.md`
- **User guides**: See `docs/docs/guides/`

---

**Ready to deploy?** Start with Step 1 and follow each step carefully!
