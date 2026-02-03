# MSP Multi-Customer Implementation - Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Changes Review
- [x] GraphQL schema updated with Customers table
- [x] Customer fields added to requests, sessions, approvers, eligibility tables
- [x] Customer management UI component created
- [x] Navigation and routing configured
- [x] Request form shows customer context
- [x] Approval views display customer column
- [x] Audit views display customer column
- [x] Documentation created

### ✅ Files Changed
```
Modified:
- amplify/backend/api/team/schema.graphql
- src/components/Navigation/Nav.js
- src/components/Navigation/Navigation.js
- src/components/Requests/Request.js
- src/components/Approvals/Approvals.js
- src/components/Requests/View.js
- src/components/Audit/AuditSessions.js
- src/components/Audit/AuditApprovals.js
- README.md

Added:
- src/components/Admin/Customers.js
- docs/MSP_SETUP_GUIDE.md
- docs/MSP_QUICK_REFERENCE.md
```

## Deployment Steps

### Step 1: Backup Current Environment
```bash
# Export current DynamoDB tables (if needed)
# Take note of current Amplify environment settings
amplify env list
```

### Step 2: Deploy Schema Changes
```bash
cd /home/runner/work/cloudiqs-msp/cloudiqs-msp

# Review pending changes
amplify status

# Push changes to create Customers table
amplify push

# When prompted:
# - Confirm schema changes: Yes
# - Update code for changes: Yes
```

Expected output:
- New DynamoDB table: `Customers-{env}`
- Updated tables with customer fields
- Updated GraphQL API

### Step 3: Verify Deployment
```bash
# Check Amplify console
amplify console

# Verify in AWS Console:
# 1. DynamoDB → Tables → Customers table exists
# 2. AppSync → Schema → Customers type visible
# 3. Lambda functions still operational
```

### Step 4: Update Frontend
```bash
# If deploying frontend separately
npm install
npm run build

# Or if using Amplify hosting
amplify publish
```

### Step 5: Test Customer Creation

1. Login as Admin user
2. Navigate to: Administration → Customers
3. Click "Create customer"
4. Fill in test customer:
   - Name: "Test Customer Org"
   - Description: "Test customer for validation"
   - Select 1-2 test accounts
   - Select approver group
   - Status: Active
5. Verify customer appears in table

### Step 6: Test Request Workflow

1. Login as regular user
2. Navigate to: Requests → Create request
3. Select an account assigned to test customer
4. Verify customer name displays in form
5. Complete and submit request
6. Check requests table shows customer column

### Step 7: Test Approval Workflow

1. Login as approver
2. Navigate to: Approvals → Approve requests
3. Verify customer column visible
4. Open a request
5. Verify customer information shown
6. Approve or reject to test workflow

### Step 8: Test Audit Views

1. Login as Auditor
2. Navigate to: Audit → Elevated access
3. Verify customer column visible
4. Navigate to: Audit → Approvals
5. Verify customer column visible
6. Test CSV export includes customer field

## Post-Deployment Tasks

### Immediate Tasks

- [ ] Create production customers
- [ ] Assign AWS accounts to customers
- [ ] Configure customer-specific approvers
- [ ] Update eligibility policies (optional customer tagging)
- [ ] Train MSP admins on customer management

### Configuration Tasks

- [ ] Review and update Settings if needed
- [ ] Create customer-specific approver policies
- [ ] Document customer onboarding process
- [ ] Set up customer contact information
- [ ] Define customer admin roles (if using)

### Communication Tasks

- [ ] Notify users about customer visibility in forms
- [ ] Train approvers on customer-scoped approvals
- [ ] Inform auditors about new customer columns
- [ ] Update internal MSP procedures
- [ ] Create customer-facing documentation (if needed)

## Rollback Plan

If issues occur, rollback procedure:

### Option 1: Revert Code Changes
```bash
# Revert to previous commit
git reset --hard HEAD~7

# Redeploy previous version
amplify push
```

### Option 2: Keep Schema, Remove UI Changes
```bash
# Keep Customers table but revert UI
git revert <commit-hash>
amplify push
```

### Option 3: Manual Cleanup
- Leave Customers table (won't affect existing functionality)
- Customer fields are optional, so old code continues to work
- No data loss on rollback

## Validation Checklist

### Functional Testing

- [ ] Admin can create customers
- [ ] Admin can edit customers
- [ ] Admin can delete customers
- [ ] Customers list displays correctly
- [ ] Account selection shows customer in request form
- [ ] Customer data saves with request
- [ ] Approvals show customer column
- [ ] Audit logs show customer column
- [ ] CSV exports include customer data
- [ ] Backwards compatibility: Accounts without customers work

### Security Testing

- [ ] Only Admins can create/edit/delete customers
- [ ] Regular users can view customer names
- [ ] Authorization rules enforced in GraphQL
- [ ] Customer data isolated properly
- [ ] No unauthorized access to customer records

### Performance Testing

- [ ] Customer list loads quickly (<2s)
- [ ] Account selection not slowed by customer lookup
- [ ] Request creation time unchanged
- [ ] Audit queries perform well with customer filter
- [ ] Large customer lists paginate properly

### Integration Testing

- [ ] IAM Identity Center groups work as approvers
- [ ] CloudTrail logs include customer context
- [ ] Notifications include customer information
- [ ] Existing approver policies still function
- [ ] Existing eligibility policies still function

## Monitoring

### Metrics to Watch

- DynamoDB Customers table read/write units
- AppSync query performance
- Lambda execution times (if affected)
- User feedback on customer visibility
- Audit log export times

### CloudWatch Logs

Monitor these log groups:
- `/aws/appsync/apis/{api-id}`
- `/aws/lambda/team*`
- Application logs in browser console

## Troubleshooting

### Issue: Customers page not loading

**Check:**
- AppSync API deployed correctly
- Customers table exists in DynamoDB
- User has Admin role in Cognito
- Browser console for JavaScript errors

**Fix:**
```bash
amplify status
amplify push
```

### Issue: Customer field not showing in request form

**Check:**
- Account has customer assignment
- Customer status is "active"
- GraphQL queries returning customer data

**Fix:**
- Refresh page
- Check customer-account mapping in Admin panel
- Verify account ID matches exactly

### Issue: GraphQL errors on customer operations

**Check:**
- Schema deployed correctly
- Authorization rules properly configured
- User has correct Cognito group membership

**Fix:**
```bash
amplify api update
amplify push
```

## Success Criteria

### Deployment Successful When:

1. ✅ Customers table created in DynamoDB
2. ✅ Customers page accessible by Admin users
3. ✅ Customer CRUD operations work
4. ✅ Request form shows customer context
5. ✅ All views display customer column
6. ✅ Backwards compatibility maintained
7. ✅ No errors in CloudWatch logs
8. ✅ Documentation accessible to users

### Ready for Production When:

1. ✅ All functional tests pass
2. ✅ Security testing complete
3. ✅ Performance acceptable
4. ✅ User training completed
5. ✅ Rollback plan tested
6. ✅ Monitoring configured
7. ✅ Support processes updated
8. ✅ Customer data populated

## Support Resources

- **Setup Guide**: docs/MSP_SETUP_GUIDE.md
- **Quick Reference**: docs/MSP_QUICK_REFERENCE.md
- **Original TEAM Docs**: https://aws-samples.github.io/iam-identity-center-team/
- **GitHub Issues**: Create issue in repository
- **AWS Support**: For infrastructure issues

## Next Steps After Deployment

1. **Week 1**: Monitor closely, gather user feedback
2. **Week 2**: Optimize based on feedback, document lessons learned
3. **Week 3**: Train additional users, expand customer base
4. **Month 1**: Review audit logs, ensure compliance requirements met
5. **Ongoing**: Regular customer data audits, keep contact info current

## Change Log

### Version: MSP Multi-Customer v1.0

**Date**: 2024

**Changes**:
- Added Customers table and management UI
- Enhanced request workflow with customer context
- Updated audit views with customer columns
- Created comprehensive documentation
- Maintained full backwards compatibility

**Impact**: Low - Additive changes only, no breaking changes

**Risk**: Low - Optional features, existing functionality unchanged

---

**Deployment Team Sign-off**:
- [ ] Technical Lead
- [ ] Security Review
- [ ] Operations Team
- [ ] Product Owner

**Deployment Date**: _________________

**Deployed By**: _________________

**Notes**: _________________________________________________
