import React from 'react';
import { Chip, Tooltip } from '@aws-amplify/ui-react';
import { FaClock, FaSpinner, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

const RoleStatusIndicator = ({ roleStatus }) => {
  const getStatusConfig = () => {
    switch (roleStatus) {
      case 'pending_approval':
        return {
          label: 'Pending Approval',
          icon: <FaClock />,
          color: 'warning',
          tooltip: 'Waiting for customer to approve invitation'
        };
      case 'approved':
        return {
          label: 'Approved',
          icon: <FaSpinner className="fa-spin" />,
          color: 'info',
          tooltip: 'Customer approved - waiting for CloudFormation deployment'
        };
      case 'established':
        return {
          label: 'Established ✓',
          icon: <FaCheckCircle />,
          color: 'success',
          tooltip: 'Role verified and ready for access requests'
        };
      case 'rejected':
        return {
          label: 'Rejected',
          icon: <FaTimesCircle />,
          color: 'error',
          tooltip: 'Customer rejected the invitation'
        };
      case 'verification_failed':
        return {
          label: 'Verification Failed',
          icon: <FaExclamationTriangle />,
          color: 'error',
          tooltip: 'Role verification failed - check configuration'
        };
      default:
        return {
          label: 'Unknown',
          icon: null,
          color: 'neutral',
          tooltip: 'Status unknown'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Tooltip content={config.tooltip}>
      <Chip
        variation={config.color}
        size="small"
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '5px',
          cursor: 'pointer'
        }}
      >
        {config.icon}
        <span>{config.label}</span>
      </Chip>
    </Tooltip>
  );
};

export default RoleStatusIndicator;
