import React, { useState, useEffect } from 'react';
import {
  Card,
  Heading,
  Text,
  Button,
  Loader,
  Alert,
  Divider,
  Badge,
  Flex,
  View,
  Icon
} from '@aws-amplify/ui-react';
import { FaCheckCircle, FaTimesCircle, FaDownload, FaExclamationTriangle } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import { API } from 'aws-amplify';

const getInvitationDetailsQuery = /* GraphQL */ `
  query GetInvitationDetails($invitationToken: String!) {
    getInvitationDetails(invitationToken: $invitationToken) {
      id
      name
      description
      adminEmail
      adminName
      permissionSet
      roleStatus
      invitationSentAt
      invitationExpiresAt
      approvedAt
      cloudFormationTemplate
      error
    }
  }
`;

const approveInvitationQuery = /* GraphQL */ `
  query ApproveInvitation($invitationToken: String!) {
    approveInvitation(invitationToken: $invitationToken) {
      success
      id
      name
      roleStatus
      approvedAt
      cloudFormationTemplate
      error
    }
  }
`;

const rejectInvitationQuery = /* GraphQL */ `
  query RejectInvitation($invitationToken: String!, $reason: String) {
    rejectInvitation(invitationToken: $invitationToken, reason: $reason) {
      success
      id
      name
      roleStatus
      error
    }
  }
`;

const CustomerApprovalPage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);

  // Extract token from URL query parameters
  const getInvitationToken = () => {
    const params = new URLSearchParams(location.search);
    return params.get('token');
  };

  useEffect(() => {
    const loadInvitationDetails = async () => {
      const token = getInvitationToken();
      
      if (!token) {
        setError('Invalid invitation link. Token is missing.');
        setLoading(false);
        return;
      }

      try {
        const result = await API.graphql({
          query: getInvitationDetailsQuery,
          variables: { invitationToken: token },
          authMode: 'API_KEY'
        });
        const data = result.data.getInvitationDetails;

        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        setCustomer(data);
        
        // Set approval/rejection status based on role status
        if (data.roleStatus === 'established' || data.roleStatus === 'approved') {
          setApproved(true);
        } else if (data.roleStatus === 'rejected') {
          setRejected(true);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation details. Please try again later.');
        setLoading(false);
      }
    };

    loadInvitationDetails();
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    const token = getInvitationToken();
    setApproving(true);
    setError(null);

    try {
      const result = await API.graphql({
        query: approveInvitationQuery,
        variables: { invitationToken: token },
        authMode: 'API_KEY'
      });
      const data = result.data.approveInvitation;

      if (data.error) {
        setError(data.error);
        setApproving(false);
        return;
      }

      setCustomer({ ...customer, ...data });
      setApproved(true);
      setApproving(false);
    } catch (err) {
      console.error('Error approving invitation:', err);
      setError('Failed to approve invitation. Please try again later.');
      setApproving(false);
    }
  };

  const handleReject = async () => {
    const token = getInvitationToken();
    
    if (!window.confirm('Are you sure you want to reject this invitation? This action cannot be undone.')) {
      return;
    }

    setRejecting(true);
    setError(null);

    try {
      const result = await API.graphql({
        query: rejectInvitationQuery,
        variables: { invitationToken: token, reason: 'Customer rejected via approval page' },
        authMode: 'API_KEY'
      });
      const data = result.data.rejectInvitation;

      if (data.error) {
        setError(data.error);
        setRejecting(false);
        return;
      }

      setRejected(true);
      setRejecting(false);
    } catch (err) {
      console.error('Error rejecting invitation:', err);
      setError('Failed to reject invitation. Please try again later.');
      setRejecting(false);
    }
  };

  const downloadCloudFormation = () => {
    if (!customer || !customer.cloudFormationTemplate) {
      setError('CloudFormation template not available');
      return;
    }

    const blob = new Blob([customer.cloudFormationTemplate], { type: 'text/yaml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudiqs-msp-role-${customer.name.replace(/\s+/g, '-').toLowerCase()}.yaml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getPermissionDescription = (permissionSet) => {
    const descriptions = {
      'read-only': 'Read-Only Access - CloudIQS MSP can view resources but cannot make changes',
      'admin': 'Administrator Access - CloudIQS MSP has full control over your AWS account',
      'custom': 'Custom Access - Specific permissions based on your requirements'
    };
    return descriptions[permissionSet] || 'Unspecified permission level';
  };

  const getExpiryWarning = () => {
    if (!customer || !customer.invitationExpiresAt) return null;
    
    const expiryDate = new Date(customer.invitationExpiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 0) {
      return <Alert variation="error" heading="Invitation Expired">This invitation has expired.</Alert>;
    } else if (daysUntilExpiry <= 2) {
      return (
        <Alert variation="warning" heading="Expiring Soon">
          This invitation expires in {daysUntilExpiry} day{daysUntilExpiry > 1 ? 's' : ''}.
        </Alert>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Flex direction="column" alignItems="center" justifyContent="center" height="100vh">
        <Loader size="large" />
        <Text marginTop="1rem">Loading invitation details...</Text>
      </Flex>
    );
  }

  if (rejected) {
    return (
      <Flex direction="column" alignItems="center" justifyContent="center" padding="2rem">
        <Card variation="outlined" padding="2rem" maxWidth="600px">
          <Flex direction="column" alignItems="center" gap="1rem">
            <Icon as={FaTimesCircle} fontSize="4rem" color="red" />
            <Heading level={3}>Invitation Rejected</Heading>
            <Text textAlign="center">
              You have successfully rejected the CloudIQS MSP access request.
              No access has been granted to your AWS account.
            </Text>
          </Flex>
        </Card>
      </Flex>
    );
  }

  if (error && !customer) {
    return (
      <Flex direction="column" alignItems="center" justifyContent="center" padding="2rem">
        <Card variation="outlined" padding="2rem" maxWidth="600px">
          <Flex direction="column" alignItems="center" gap="1rem">
            <Icon as={FaExclamationTriangle} fontSize="4rem" color="orange" />
            <Heading level={3}>Error Loading Invitation</Heading>
            <Text textAlign="center" color="red">{error}</Text>
          </Flex>
        </Card>
      </Flex>
    );
  }

  return (
    <Flex direction="column" padding="2rem" maxWidth="1000px" margin="0 auto">
      <Card variation="outlined" padding="2rem">
        <Heading level={2} marginBottom="1rem">
          CloudIQS MSP Access Request
        </Heading>
        
        {getExpiryWarning()}
        
        {error && (
          <Alert variation="error" marginTop="1rem" isDismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {customer && (
          <>
            <Divider marginTop="1rem" marginBottom="1rem" />
            
            <Flex direction="column" gap="1rem">
              <View>
                <Text fontWeight="bold">Organization:</Text>
                <Text>{customer.name}</Text>
              </View>
              
              {customer.description && (
                <View>
                  <Text fontWeight="bold">Description:</Text>
                  <Text>{customer.description}</Text>
                </View>
              )}
              
              <View>
                <Text fontWeight="bold">Permission Level:</Text>
                <Badge variation={customer.permissionSet === 'admin' ? 'error' : 'info'}>
                  {customer.permissionSet?.toUpperCase() || 'UNSPECIFIED'}
                </Badge>
                <Text fontSize="0.9rem" color="gray" marginTop="0.5rem">
                  {getPermissionDescription(customer.permissionSet)}
                </Text>
              </View>

              <View>
                <Text fontWeight="bold">Administrator Contact:</Text>
                <Text>{customer.adminName || 'N/A'} ({customer.adminEmail})</Text>
              </View>
            </Flex>

            <Divider marginTop="1.5rem" marginBottom="1.5rem" />

            <Heading level={4} marginBottom="1rem">Approval Process</Heading>

            {!approved && !rejected && (
              <View marginTop="1.5rem">
                <Heading level={5} marginBottom="1rem">Step 1: Review & Approve</Heading>
                <Text marginBottom="1rem">
                  Please review the access details above. If you agree to grant CloudIQS MSP access to your AWS account,
                  click the "Approve Request" button below.
                </Text>
                <Flex gap="1rem">
                  <Button
                    variation="primary"
                    onClick={handleApprove}
                    isLoading={approving}
                    loadingText="Approving..."
                    size="large"
                  >
                    <Icon as={FaCheckCircle} marginRight="0.5rem" />
                    Approve Request
                  </Button>
                  <Button
                    variation="destructive"
                    onClick={handleReject}
                    isLoading={rejecting}
                    loadingText="Rejecting..."
                    size="large"
                  >
                    <Icon as={FaTimesCircle} marginRight="0.5rem" />
                    Reject Request
                  </Button>
                </Flex>
              </View>
            )}

            {approved && (
              <>
                <Alert variation="success" marginBottom="1.5rem">
                  <Icon as={FaCheckCircle} marginRight="0.5rem" />
                  Request approved successfully!
                </Alert>

                <View marginBottom="1.5rem">
                  <Heading level={5} marginBottom="1rem">Step 2: Download CloudFormation Template</Heading>
                  <Text marginBottom="1rem">
                    Download the CloudFormation template that will create the IAM role in your AWS account.
                  </Text>
                  <Button
                    variation="primary"
                    onClick={downloadCloudFormation}
                    size="large"
                  >
                    <Icon as={FaDownload} marginRight="0.5rem" />
                    Download CloudFormation Template
                  </Button>
                </View>

                <View marginBottom="1.5rem">
                  <Heading level={5} marginBottom="1rem">Step 3: Deploy in Your AWS Account</Heading>
                  <Text marginBottom="1rem">
                    Follow these steps to deploy the CloudFormation template:
                  </Text>
                  <ol style={{ marginLeft: '1.5rem' }}>
                    <li>Log in to your AWS account</li>
                    <li>Navigate to the CloudFormation console</li>
                    <li>Click "Create stack" → "With new resources"</li>
                    <li>Select "Upload a template file" and choose the downloaded file</li>
                    <li>Click "Next" and follow the wizard (keep default parameters)</li>
                    <li>Acknowledge that CloudFormation might create IAM resources</li>
                    <li>Click "Create stack" and wait for completion (usually 1-2 minutes)</li>
                  </ol>
                </View>

                <View>
                  <Heading level={5} marginBottom="1rem">Step 4: Verification</Heading>
                  <Text>
                    Once you've deployed the CloudFormation stack, CloudIQS MSP will automatically verify 
                    the role within a few minutes. You'll receive a confirmation email when the setup is complete.
                  </Text>
                  {customer.roleStatus === 'established' && (
                    <Alert variation="success" marginTop="1rem">
                      <Icon as={FaCheckCircle} marginRight="0.5rem" />
                      Role has been verified! CloudIQS MSP can now access your account.
                    </Alert>
                  )}
                </View>
              </>
            )}

            <Divider marginTop="1.5rem" marginBottom="1.5rem" />

            <View backgroundColor="gray.100" padding="1rem" borderRadius="0.5rem">
              <Heading level={6} marginBottom="0.5rem">🔒 Security Notes:</Heading>
              <ul style={{ marginLeft: '1.5rem', fontSize: '0.9rem' }}>
                <li>You maintain full control of your AWS organization</li>
                <li>The role uses a secure ExternalId for additional protection</li>
                <li>You can revoke access at any time by deleting the CloudFormation stack</li>
                <li>All access is logged in CloudTrail for audit purposes</li>
              </ul>
            </View>
          </>
        )}
      </Card>
    </Flex>
  );
};

export default CustomerApprovalPage;
