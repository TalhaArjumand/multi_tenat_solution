ROLE_NAME_MAP = {
    'ReadOnlyAccess': 'CloudIQS-MSP-ReadOnlyRole',
    'S3FullAccess': 'CloudIQS-MSP-S3AdminRole',
    'EC2FullAccess': 'CloudIQS-MSP-EC2AdminRole',
    'PowerUserAccess': 'CloudIQS-MSP-PowerUserRole',
    'AdministratorAccess': 'CloudIQS-MSP-AdminRole',
    'DatabaseAdmin': 'CloudIQS-MSP-DatabaseAdminRole',
    'NetworkAdmin': 'CloudIQS-MSP-NetworkAdminRole',
    'SecurityAudit': 'CloudIQS-MSP-SecurityAuditRole',
}


def get_role_arn(account_id, role_name):
    """Map a multi-tenant role name to the full IAM role ARN in the customer account."""
    iam_role_name = ROLE_NAME_MAP.get(role_name, 'CloudIQS-MSP-AccessRole')
    return f"arn:aws:iam::{account_id}:role/{iam_role_name}"
