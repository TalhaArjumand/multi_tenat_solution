# Add at the top with other env vars:
customers_table_name = os.getenv("CUSTOMERS_TABLE_NAME")

# Add this new function:
def check_multi_tenant_eligibility(request):
    """
    Check if request is for a multi-tenant customer account.
    If so, validate eligibility based on Customers table.
    """
    account_id = request.get("accountId")
    role_id = request.get("roleId", "")
    
    # Check if this is a multi-tenant role ID
    if not role_id.startswith("mt-"):
        return None  # Not multi-tenant, use normal flow
    
    # Look up customer
    try:
        customers_table = dynamodb.Table(customers_table_name)
        response = customers_table.scan(
            FilterExpression='contains(accountIds, :acctId) AND roleStatus = :status',
            ExpressionAttributeValues={
                ':acctId': account_id,
                ':status': 'established'
            }
        )
        
        if not response.get('Items'):
            print(f"No established customer found for account {account_id}")
            return False
        
        customer = response['Items'][0]
        
        # Validate role is allowed for this customer's permission set
        role_name = role_id.replace("mt-", "")
        allowed_roles = get_allowed_roles_for_permission_set(customer.get('permissionSet', 'read-only'))
        
        if role_name not in allowed_roles:
            print(f"Role {role_name} not allowed for customer {customer['name']} (permissionSet: {customer['permissionSet']})")
            return False
        
        return {"approval": True}  # Multi-tenant always requires approval
        
    except Exception as e:
        print(f"Error checking multi-tenant eligibility: {e}")
        return False


def get_allowed_roles_for_permission_set(permission_set):
    """Map customer's permission set to allowed roles."""
    if permission_set == 'admin':
        return ['ReadOnlyAccess', 'S3FullAccess', 'EC2FullAccess', 'PowerUserAccess',
                'AdministratorAccess', 'DatabaseAdmin', 'NetworkAdmin', 'SecurityAudit']
    elif permission_set == 'read-only':
        return ['ReadOnlyAccess', 'SecurityAudit']
    else:
        return ['ReadOnlyAccess', 'S3FullAccess', 'EC2FullAccess',
                'DatabaseAdmin', 'NetworkAdmin', 'SecurityAudit']


# Then modify the handler function - add this check before the existing eligibility check:
# In the handler() function, after request_is_updated check, add:

def handler(event, context):
    data = event["Records"].pop()["dynamodb"]["NewImage"]
    print("Checking if request is updated")
    status = data["status"]["S"]
    username = data["username"]["S"]
    request_id = data["id"]["S"]
    if request_is_updated(status, data, username, request_id):
        settings = check_settings()
        approval_required = settings["approval_required"]
        notification_config = settings["notification_config"]
        expiry_time = settings["expiry"]
        request = get_request_data(data, expiry_time, approval_required)
        
        if int(request["time"]) > int(settings["max_duration"]):
            print("Error: Invalid Duration")
            input = {'id': request["id"], 'status': 'error'}
            return updateRequest(input)
        
        print("Received event: %s" % json.dumps(request))
        
        # Check if this is a multi-tenant request
        role_id = data.get("roleId", {}).get("S", "")
        if role_id.startswith("mt-"):
            # Multi-tenant flow
            mt_eligible = check_multi_tenant_eligibility(request)
            if mt_eligible is False:
                return eligibility_error(request)
            if mt_eligible:
                request["approvalRequired"] = mt_eligible.get("approval", True)
                request["isMultiTenant"] = True
                invoke_workflow(request, True, notification_config, team_config)
        else:
            # Existing SSO flow
            userId = get_user((data["username"]["S"])[4:])
            request["userId"] = userId
            eligible = get_eligibility(request, userId)
            if eligible:
                if approval_required:
                    approval_required = eligible["approval"]
                    request["approvalRequired"] = eligible["approval"]
                invoke_workflow(request, approval_required, notification_config, team_config)
    else:
        print("Request not updated")