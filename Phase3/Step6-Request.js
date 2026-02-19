// Add this constant at the top of the file, after imports:

const MULTI_TENANT_ROLES = [
    { name: 'ReadOnlyAccess', id: 'mt-ReadOnlyAccess', description: 'Read-only access to all resources' },
    { name: 'S3FullAccess', id: 'mt-S3FullAccess', description: 'Full S3 access' },
    { name: 'EC2FullAccess', id: 'mt-EC2FullAccess', description: 'Full EC2 access' },
    { name: 'PowerUserAccess', id: 'mt-PowerUserAccess', description: 'Full access except IAM' },
    { name: 'AdministratorAccess', id: 'mt-AdministratorAccess', description: 'Full admin access' },
    { name: 'DatabaseAdmin', id: 'mt-DatabaseAdmin', description: 'RDS and DynamoDB access' },
    { name: 'NetworkAdmin', id: 'mt-NetworkAdmin', description: 'VPC and Route53 access' },
    { name: 'SecurityAudit', id: 'mt-SecurityAudit', description: 'Security audit access' },
  ];
  
  // Then modify the getPermissions function:
  
  async function getPermissions(accountId) {
    let permissionData = [];
    setRole([]);
    
    // Check if this account belongs to a multi-tenant customer
    const customer = customers.find(c => 
      c.accountIds && c.accountIds.includes(accountId) && 
      c.roleStatus === 'established'
    );
    
    if (customer) {
      // Multi-tenant customer - show pre-defined roles based on customer's permission set
      let availableRoles = [];
      switch (customer.permissionSet) {
        case 'admin':
          availableRoles = MULTI_TENANT_ROLES;
          break;
        case 'read-only':
          availableRoles = MULTI_TENANT_ROLES.filter(r => 
            ['ReadOnlyAccess', 'SecurityAudit'].includes(r.name)
          );
          break;
        case 'custom':
          // For custom, show roles based on what was deployed
          availableRoles = MULTI_TENANT_ROLES;
          break;
        default:
          availableRoles = MULTI_TENANT_ROLES.filter(r => r.name === 'ReadOnlyAccess');
      }
      setPermissions(availableRoles);
      setPermissionStatus("finished");
    } else {
      // Internal account - use existing SSO permission sets
      item.forEach((data) => {
        data.accounts.forEach((account) => {
          if (account.id === accountId) {
            permissionData = permissionData.concat(data.permissions);
          }
        });
      });
      setPermissions(concatenatePermissions(permissionData));
    }
    return permissionData;
  }