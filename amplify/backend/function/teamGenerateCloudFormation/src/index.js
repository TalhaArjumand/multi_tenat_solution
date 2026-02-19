/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	MSP_ACCOUNT_ID
Amplify Params - DO NOT EDIT */

import yaml from 'js-yaml';

const MSP_ACCOUNT_ID = process.env.MSP_ACCOUNT_ID || '722560225075';

/**
 * Role definitions that will be created in the customer's account.
 * Each role maps to a specific set of AWS managed policies.
 */
const ROLE_DEFINITIONS = {
  'ReadOnlyAccess': {
    roleName: 'CloudIQS-MSP-ReadOnlyRole',
    managedPolicies: ['arn:aws:iam::aws:policy/ReadOnlyAccess'],
    description: 'Read-only access for security assessments and monitoring'
  },
  'S3FullAccess': {
    roleName: 'CloudIQS-MSP-S3AdminRole',
    managedPolicies: ['arn:aws:iam::aws:policy/AmazonS3FullAccess'],
    description: 'Full S3 access for data management'
  },
  'EC2FullAccess': {
    roleName: 'CloudIQS-MSP-EC2AdminRole',
    managedPolicies: ['arn:aws:iam::aws:policy/AmazonEC2FullAccess'],
    description: 'Full EC2 access for infrastructure management'
  },
  'PowerUserAccess': {
    roleName: 'CloudIQS-MSP-PowerUserRole',
    managedPolicies: ['arn:aws:iam::aws:policy/PowerUserAccess'],
    description: 'Power user access (full access except IAM)'
  },
  'AdministratorAccess': {
    roleName: 'CloudIQS-MSP-AdminRole',
    managedPolicies: ['arn:aws:iam::aws:policy/AdministratorAccess'],
    description: 'Full administrative access'
  },
  'DatabaseAdmin': {
    roleName: 'CloudIQS-MSP-DatabaseAdminRole',
    managedPolicies: [
      'arn:aws:iam::aws:policy/AmazonRDSFullAccess',
      'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'
    ],
    description: 'Database administration access'
  },
  'NetworkAdmin': {
    roleName: 'CloudIQS-MSP-NetworkAdminRole',
    managedPolicies: [
      'arn:aws:iam::aws:policy/AmazonVPCFullAccess',
      'arn:aws:iam::aws:policy/AmazonRoute53FullAccess'
    ],
    description: 'Network administration access'
  },
  'SecurityAudit': {
    roleName: 'CloudIQS-MSP-SecurityAuditRole',
    managedPolicies: [
      'arn:aws:iam::aws:policy/SecurityAudit',
      'arn:aws:iam::aws:policy/AWSCloudTrail_ReadOnlyAccess'
    ],
    description: 'Security audit and compliance review'
  }
};

function generateMultiRoleCloudFormation(selectedRoles, externalId, customerName) {
  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `CloudIQS MSP Access Roles for ${customerName} - Multi-Role Setup`,
    Metadata: {
      'CloudIQS-MSP': {
        CustomerName: customerName,
        CreatedBy: 'CloudIQS MSP Portal',
        Purpose: 'Cross-account access roles for managed services'
      }
    },
    Resources: {},
    Outputs: {}
  };

  for (const roleName of selectedRoles) {
    const roleDef = ROLE_DEFINITIONS[roleName];
    if (!roleDef) continue;

    const resourceName = roleDef.roleName.replace(/-/g, '');

    template.Resources[resourceName] = {
      Type: 'AWS::IAM::Role',
      Properties: {
        RoleName: roleDef.roleName,
        Description: `${roleDef.description} - Managed by CloudIQS MSP`,
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${MSP_ACCOUNT_ID}:root`
              },
              Action: 'sts:AssumeRole',
              Condition: {
                StringEquals: {
                  'sts:ExternalId': externalId
                }
              }
            }
          ]
        },
        ManagedPolicyArns: roleDef.managedPolicies,
        MaxSessionDuration: 43200,
        Tags: [
          { Key: 'ManagedBy', Value: 'CloudIQS-MSP' },
          { Key: 'Customer', Value: customerName },
          { Key: 'AccessLevel', Value: roleName },
          { Key: 'CreatedVia', Value: 'CloudFormation' }
        ]
      }
    };

    template.Outputs[`${resourceName}Arn`] = {
      Description: `ARN of ${roleDef.roleName}`,
      Value: { 'Fn::GetAtt': [resourceName, 'Arn'] }
    };
  }

  return yaml.dump(template, { lineWidth: -1 });
}

function getManagedPolicies(permissionSet) {
  switch (permissionSet) {
    case 'read-only':
      return ['arn:aws:iam::aws:policy/ReadOnlyAccess'];
    case 'admin':
      return ['arn:aws:iam::aws:policy/AdministratorAccess'];
    case 'custom':
      return ['arn:aws:iam::aws:policy/ReadOnlyAccess'];
    default:
      return ['arn:aws:iam::aws:policy/ReadOnlyAccess'];
  }
}

function getRolesForPermissionSet(permissionSet) {
  switch (permissionSet) {
    case 'read-only':
      return ['ReadOnlyAccess', 'SecurityAudit'];
    case 'admin':
      return Object.keys(ROLE_DEFINITIONS);
    case 'custom':
      return Object.keys(ROLE_DEFINITIONS).filter(r => r !== 'AdministratorAccess');
    default:
      return ['ReadOnlyAccess'];
  }
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    const { customerId, customerName, permissionSet, externalId, customerAccountId, selectedRoles } = event;
    
    // Validate required fields
    if (!customerId || !customerName || !externalId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['customerId', 'customerName', 'externalId']
        })
      };
    }
    
    // Determine which roles to create
    let rolesToCreate;
    if (selectedRoles && Array.isArray(selectedRoles) && selectedRoles.length > 0) {
      rolesToCreate = selectedRoles;
    } else if (permissionSet) {
      rolesToCreate = getRolesForPermissionSet(permissionSet);
    } else {
      rolesToCreate = ['ReadOnlyAccess'];
    }

    const cfnTemplate = generateMultiRoleCloudFormation(rolesToCreate, externalId, customerName);
    
    console.log('Generated multi-role CloudFormation template successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        customerId,
        customerName,
        permissionSet,
        availableRoles: rolesToCreate,
        cloudFormationTemplate: cfnTemplate
      })
    };
  } catch (error) {
    console.error('Error generating CloudFormation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
