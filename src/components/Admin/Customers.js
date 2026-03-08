// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Header,
  Pagination,
  Table,
  TextFilter,
  SpaceBetween,
  CollectionPreferences,
  Multiselect,
  Modal,
  FormField,
  Form,
  Select,
  ColumnLayout,
  Input,
  Spinner,
  Textarea,
  StatusIndicator,
  Alert,
  TokenGroup,
  Checkbox
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import { API, graphqlOperation } from "aws-amplify";
import {
  fetchIdCGroups
} from "../Shared/RequestService";
import RoleStatusIndicator from "./RoleStatusIndicator";
import "../../index.css";
import * as mutations from "../../graphql/mutations";
import * as queries from "../../graphql/queries";

const MSP_ROLE_NAME = 'CloudIQS-MSP-ReadOnlyRole';

const COLUMN_DEFINITIONS = [
  {
    id: "id",
    sortingField: "id",
    header: "Customer ID",
    cell: (item) => item.id,
    width: 180,
  },
  {
    id: "name",
    sortingField: "name",
    header: "Customer Name",
    cell: (item) => item.name,
    width: 200,
  },
  {
    id: "status",
    sortingField: "status",
    header: "Status",
    cell: (item) => (
      <StatusIndicator type={item.status === 'active' ? 'success' : 'stopped'}>
        {item.status || 'active'}
      </StatusIndicator>
    ),
    width: 120,
  },
  {
    id: "roleStatus",
    sortingField: "roleStatus",
    header: "Role Status",
    cell: (item) => item.roleStatus ? <RoleStatusIndicator roleStatus={item.roleStatus} /> : "-",
    width: 180,
  },
  {
    id: "permissionSet",
    sortingField: "permissionSet",
    header: "Permission Set",
    cell: (item) => item.permissionSet ? item.permissionSet.toUpperCase() : "-",
    width: 150,
  },
  {
    id: "accountCount",
    header: "Accounts",
    cell: (item) => (item.accountIds ? item.accountIds.length : 0),
    width: 100,
  },
  {
    id: "adminEmail",
    sortingField: "adminEmail",
    header: "Admin Email",
    cell: (item) => item.adminEmail || "-",
    width: 220,
  },
  {
    id: "description",
    header: "Description",
    cell: (item) => item.description || "-",
    width: 250,
  },
];

const MyCollectionPreferences = ({ preferences, setPreferences }) => {
  return (
    <CollectionPreferences
      title="Preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: "Page size",
        options: [
          { value: 10, label: "10 Customers" },
          { value: 30, label: "30 Customers" },
          { value: 50, label: "50 Customers" },
        ],
      }}
      visibleContentPreference={{
        title: "Select visible columns",
        options: [
          {
            label: "Customer properties",
            options: COLUMN_DEFINITIONS.map((c) => ({
              id: c.id,
              label: c.header,
              editable: c.id !== "id",
            })),
          },
        ],
      }}
    />
  );
};

function Customers(props) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerDescription, setCustomerDescription] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [status, setStatus] = useState({ label: "Active", value: "active" });
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [accountIdInput, setAccountIdInput] = useState("");
  const [accountIdError, setAccountIdError] = useState("");
  const [selectedApproverGroups, setSelectedApproverGroups] = useState([]);
  const [permissionSet, setPermissionSet] = useState({ label: "Read-Only", value: "read-only" });
  
  // Data sources
  const [approverGroups, setApproverGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  
  // Form validation
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [notificationEmailError, setNotificationEmailError] = useState("");
  
  // Role verification
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [roleArnInput, setRoleArnInput] = useState("");
  const [roleArnError, setRoleArnError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [resending, setResending] = useState(false);

  const [preferences, setPreferences] = useState({
    pageSize: 30,
    visibleContent: ["id", "name", "status", "roleStatus", "permissionSet", "accountCount", "adminEmail", "description"],
  });

  const {
    items,
    filteredItemsCount,
    collectionProps,
    filterProps,
    paginationProps,
  } = useCollection(customers, {
    filtering: {
      empty: (
        <Box textAlign="center" color="inherit">
          <b>No customers</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            No customers to display.
          </Box>
          <Button onClick={() => setAddModalVisible(true)}>
            Create customer
          </Button>
        </Box>
      ),
      noMatch: (
        <Box textAlign="center" color="inherit">
          <b>No match</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            No customers matched.
          </Box>
        </Box>
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {},
    selection: {},
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const result = await API.graphql(graphqlOperation(queries.listCustomers));
      const customerList = result.data.listCustomers.items || [];
      setCustomers(customerList);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateAccountId = (accountId) => {
    const trimmed = accountId.trim();
    if (!trimmed) return null;
    if (!/^\d{12}$/.test(trimmed)) {
      return "AWS Account ID must be exactly 12 digits";
    }
    if (selectedAccounts.some(acc => acc.label === trimmed)) {
      return "This account ID has already been added";
    }
    return null;
  };

  const addAccountId = () => {
    const trimmed = accountIdInput.trim();
    if (!trimmed) return;
    
    const error = validateAccountId(trimmed);
    if (error) {
      setAccountIdError(error);
      return;
    }
    
    setSelectedAccounts([...selectedAccounts, { label: trimmed, dismissLabel: `Remove ${trimmed}` }]);
    setAccountIdInput("");
    setAccountIdError("");
  };

  const loadApproverGroups = async () => {
    setGroupsLoading(true);
    try {
      const groupData = await fetchIdCGroups();
      setApproverGroups(
        groupData.map((group) => ({
          label: group.DisplayName,
          value: group.GroupId,
          description: group.GroupId,
        }))
      );
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const openAddModal = () => {
    resetForm();
    loadApproverGroups();
    setAddModalVisible(true);
  };

  const openEditModal = () => {
    if (selectedCustomer.length === 1) {
      const customer = selectedCustomer[0];
      setCustomerName(customer.name);
      setCustomerDescription(customer.description || "");
      setAdminEmail(customer.adminEmail || "");
      setAdminName(customer.adminName || "");
      setNotificationEmail(customer.notificationEmail || "");
      setNotificationsEnabled(Boolean(customer.notificationsEnabled));
      setStatus({
        label: customer.status === 'active' ? 'Active' : 'Inactive',
        value: customer.status || 'active'
      });
      setPermissionSet({
        label: customer.permissionSet === 'admin' ? 'Admin' : customer.permissionSet === 'custom' ? 'Custom' : 'Read-Only',
        value: customer.permissionSet || 'read-only'
      });
      
      // Set account IDs as tokens
      if (customer.accountIds) {
        setSelectedAccounts(customer.accountIds.map(id => ({
          label: id,
          dismissLabel: `Remove ${id}`
        })));
      }
      
      // Load groups and set selected
      loadApproverGroups().then(() => {
        if (customer.approverGroupIds) {
          const selected = customer.approverGroupIds.map(id => {
            const group = approverGroups.find(g => g.value === id);
            return group || { label: id, value: id };
          });
          setSelectedApproverGroups(selected);
        }
      });
      
      setEditModalVisible(true);
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerDescription("");
    setAdminEmail("");
    setAdminName("");
    setNotificationEmail("");
    setNotificationsEnabled(false);
    setStatus({ label: "Active", value: "active" });
    setPermissionSet({ label: "Read-Only", value: "read-only" });
    setSelectedAccounts([]);
    setAccountIdInput("");
    setAccountIdError("");
    setSelectedApproverGroups([]);
    setNameError("");
    setEmailError("");
    setNotificationEmailError("");
  };

  const validateForm = () => {
    let isValid = true;
    
    if (!customerName.trim()) {
      setNameError("Customer name is required");
      isValid = false;
    } else {
      setNameError("");
    }
    
    if (adminEmail && !adminEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError("Please enter a valid email address");
      isValid = false;
    } else {
      setEmailError("");
    }

    if (notificationEmail && !notificationEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setNotificationEmailError("Please enter a valid notification email address");
      isValid = false;
    } else if (notificationsEnabled && !notificationEmail.trim()) {
      setNotificationEmailError("Notification email is required when customer notifications are enabled");
      isValid = false;
    } else {
      setNotificationEmailError("");
    }
    
    return isValid;
  };

  const handleAddCustomer = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // Generate a unique external ID for AssumeRole security
      const externalId = crypto.randomUUID ? crypto.randomUUID() : 
        Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      
      // Generate a secure invitation token
      const invitationToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const input = {
        name: customerName,
        description: customerDescription,
        adminEmail: adminEmail,
        adminName: adminName,
        notificationEmail: notificationEmail || null,
        notificationsEnabled,
        status: status.value,
        accountIds: selectedAccounts.map(acc => acc.label),
        approverGroupIds: selectedApproverGroups.map(grp => grp.value),
        modifiedBy: props.user || "system",
        // Role-based onboarding fields
        permissionSet: permissionSet.value,
        roleStatus: "pending_approval",
        externalId: externalId,
        invitationToken: invitationToken
      };
      
      const result = await API.graphql(
        graphqlOperation(mutations.createCustomers, { input })
      );
      
      const newCustomer = result.data.createCustomers;
      
      // Trigger send invitation email if admin email is provided
      if (adminEmail) {
        try {
          await API.graphql(
            graphqlOperation(queries.sendCustomerInvitation, {
              customerId: newCustomer.id,
              customerName: customerName,
              adminEmail: adminEmail,
              adminName: adminName,
              invitationToken: invitationToken,
              permissionSet: permissionSet.value
            })
          );
          
          if (props.addNotification) {
            props.addNotification([{
              type: 'success',
              content: `Customer "${customerName}" created successfully! An invitation email has been sent to ${adminEmail}.`,
              dismissible: true,
              dismissLabel: 'Dismiss',
              onDismiss: () => props.addNotification([])
            }]);
          }
        } catch (emailError) {
          console.error('Error sending invitation email:', emailError);
          if (props.addNotification) {
            props.addNotification([{
              type: 'warning',
              content: `Customer "${customerName}" created, but failed to send invitation email. You can resend it later.`,
              dismissible: true,
              dismissLabel: 'Dismiss',
              onDismiss: () => props.addNotification([])
            }]);
          }
        }
      } else {
        if (props.addNotification) {
          props.addNotification([{
            type: 'success',
            content: `Customer "${customerName}" created successfully. No invitation email sent (no admin email provided).`,
            dismissible: true,
            dismissLabel: 'Dismiss',
            onDismiss: () => props.addNotification([])
          }]);
        }
      }
      
      setAddModalVisible(false);
      fetchCustomers();
      resetForm();
    } catch (error) {
      console.error("Error creating customer:", error);
      if (props.addNotification) {
        props.addNotification([{
          type: 'error',
          content: `Error creating customer: ${error.message || error.errors?.[0]?.message || 'Unknown error'}`,
          dismissible: true,
          dismissLabel: 'Dismiss',
          onDismiss: () => props.addNotification([])
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const input = {
        id: selectedCustomer[0].id,
        name: customerName,
        description: customerDescription,
        adminEmail: adminEmail,
        adminName: adminName,
        notificationEmail: notificationEmail || null,
        notificationsEnabled,
        status: status.value,
        accountIds: selectedAccounts.map(acc => acc.label),
        approverGroupIds: selectedApproverGroups.map(grp => grp.value),
        modifiedBy: props.user || "system"
      };
      
      await API.graphql(
        graphqlOperation(mutations.updateCustomers, { input })
      );
      
      setEditModalVisible(false);
      fetchCustomers();
      setSelectedCustomer([]);
      resetForm();
    } catch (error) {
      console.error("Error updating customer:", error);
      alert("Error updating customer: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    setLoading(true);
    try {
      for (const customer of selectedCustomer) {
        await API.graphql(
          graphqlOperation(mutations.deleteCustomers, {
            input: { id: customer.id },
          })
        );
      }
      
      setDeleteModalVisible(false);
      fetchCustomers();
      setSelectedCustomer([]);
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Error deleting customer: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async () => {
    if (selectedCustomer.length !== 1) return;
    const customer = selectedCustomer[0];
    
    if (!customer.adminEmail) {
      if (props.addNotification) {
        props.addNotification([{
          type: 'error',
          content: 'Cannot resend invitation: No admin email configured for this customer.',
          dismissible: true,
          dismissLabel: 'Dismiss',
          onDismiss: () => props.addNotification([])
        }]);
      }
      return;
    }
    
    setResending(true);
    try {
      await API.graphql(
        graphqlOperation(queries.sendCustomerInvitation, {
          customerId: customer.id,
          customerName: customer.name,
          adminEmail: customer.adminEmail,
          adminName: customer.adminName,
          invitationToken: customer.invitationToken,
          permissionSet: customer.permissionSet || 'read-only'
        })
      );
      
      if (props.addNotification) {
        props.addNotification([{
          type: 'success',
          content: `Invitation email resent to ${customer.adminEmail}.`,
          dismissible: true,
          dismissLabel: 'Dismiss',
          onDismiss: () => props.addNotification([])
        }]);
      }
      fetchCustomers();
    } catch (error) {
      console.error('Error resending invitation:', error);
      if (props.addNotification) {
        props.addNotification([{
          type: 'error',
          content: `Error resending invitation: ${error.message || error.errors?.[0]?.message || 'Unknown error'}`,
          dismissible: true,
          dismissLabel: 'Dismiss',
          onDismiss: () => props.addNotification([])
        }]);
      }
    } finally {
      setResending(false);
    }
  };

  const openVerifyModal = () => {
    if (selectedCustomer.length !== 1) return;
    const customer = selectedCustomer[0];
    
    // Pre-populate roleArn if available, or build expected ARN
    if (customer.roleArn) {
      setRoleArnInput(customer.roleArn);
    } else if (customer.accountIds && customer.accountIds.length > 0) {
      setRoleArnInput(`arn:aws:iam::${customer.accountIds[0]}:role/${MSP_ROLE_NAME}`);
    } else {
      setRoleArnInput("");
    }
    setRoleArnError("");
    setVerifyResult(null);
    setVerifyModalVisible(true);
  };

  const handleVerifyRole = async () => {
    if (selectedCustomer.length !== 1) return;
    const customer = selectedCustomer[0];
    
    if (!roleArnInput.trim()) {
      setRoleArnError("Role ARN is required");
      return;
    }
    
    if (!/^arn:aws:iam::\d{12}:role\/.+$/.test(roleArnInput.trim())) {
      setRoleArnError("Invalid ARN format. Expected: arn:aws:iam::<account-id>:role/<role-name>");
      return;
    }
    
    setVerifying(true);
    setVerifyResult(null);
    setRoleArnError("");
    
    try {
      const result = await API.graphql(
        graphqlOperation(queries.verifyCustomerRole, {
          customerId: customer.id,
          roleArn: roleArnInput.trim(),
          externalId: customer.externalId
        })
      );
      
      const verification = result.data.verifyCustomerRole;
      setVerifyResult(verification);
      
      if (verification.success) {
        if (props.addNotification) {
          props.addNotification([{
            type: 'success',
            content: `Role verified successfully for "${customer.name}". Status: Established.`,
            dismissible: true,
            dismissLabel: 'Dismiss',
            onDismiss: () => props.addNotification([])
          }]);
        }
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error verifying role:', error);
      setVerifyResult({ success: false, error: error.message || error.errors?.[0]?.message || 'Unknown error' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Table
        {...collectionProps}
        onSelectionChange={({ detail }) =>
          setSelectedCustomer(detail.selectedItems)
        }
        selectedItems={selectedCustomer}
        ariaLabels={{
          selectionGroupLabel: "Items selection",
          allItemsSelectionLabel: ({ selectedItems }) =>
            `${selectedItems.length} ${
              selectedItems.length === 1 ? "item" : "items"
            } selected`,
          itemSelectionLabel: ({ selectedItems }, item) =>
            item.name,
        }}
        columnDefinitions={COLUMN_DEFINITIONS}
        visibleColumns={preferences.visibleContent}
        items={items}
        loading={loading}
        loadingText="Loading customers"
        selectionType="multi"
        trackBy="id"
        empty={
          <Box textAlign="center" color="inherit">
            <b>No customers</b>
            <Box padding={{ bottom: "s" }} variant="p" color="inherit">
              No customers to display.
            </Box>
            <Button onClick={openAddModal}>Create customer</Button>
          </Box>
        }
        filter={
          <TextFilter
            {...filterProps}
            countText={`${filteredItemsCount} ${
              filteredItemsCount === 1 ? "match" : "matches"
            }`}
            filteringAriaLabel="Filter customers"
          />
        }
        header={
          <Header
            counter={`(${customers.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={fetchCustomers}
                  iconName="refresh"
                  ariaLabel="Refresh"
                />
                <Button
                  disabled={selectedCustomer.length !== 1 || !selectedCustomer[0]?.adminEmail}
                  onClick={handleResendInvitation}
                  loading={resending}
                >
                  Resend invitation
                </Button>
                <Button
                  disabled={
                    selectedCustomer.length !== 1 ||
                    !selectedCustomer[0]?.externalId ||
                    selectedCustomer[0]?.roleStatus === 'established'
                  }
                  onClick={openVerifyModal}
                >
                  Verify role
                </Button>
                <Button
                  disabled={selectedCustomer.length !== 1}
                  onClick={openEditModal}
                >
                  Edit
                </Button>
                <Button
                  disabled={selectedCustomer.length === 0}
                  onClick={() => setDeleteModalVisible(true)}
                >
                  Delete
                </Button>
                <Button variant="primary" onClick={openAddModal}>
                  Create customer
                </Button>
              </SpaceBetween>
            }
          >
            Customers
          </Header>
        }
        pagination={<Pagination {...paginationProps} />}
        preferences={
          <MyCollectionPreferences
            preferences={preferences}
            setPreferences={setPreferences}
          />
        }
      />

      {/* Add Customer Modal */}
      <Modal
        onDismiss={() => setAddModalVisible(false)}
        visible={addModalVisible}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setAddModalVisible(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddCustomer}
                loading={loading}
              >
                Create customer
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Create customer"
      >
        <Form>
          <SpaceBetween size="m">
            <FormField
              label="Customer name"
              errorText={nameError}
              stretch
              constraintText="Required. The name of the customer organization."
            >
              <Input
                value={customerName}
                onChange={({ detail }) => setCustomerName(detail.value)}
                placeholder="e.g., Acme Corporation"
              />
            </FormField>

            <FormField
              label="Description"
              stretch
              constraintText="Optional. A brief description of the customer."
            >
              <Textarea
                value={customerDescription}
                onChange={({ detail }) => setCustomerDescription(detail.value)}
                placeholder="e.g., Primary customer for product X"
              />
            </FormField>

            <ColumnLayout columns={2}>
              <FormField
                label="Admin name"
                stretch
                constraintText="Optional. Primary contact name."
              >
                <Input
                  value={adminName}
                  onChange={({ detail }) => setAdminName(detail.value)}
                  placeholder="e.g., John Doe"
                />
              </FormField>

              <FormField
                label="Admin email"
                errorText={emailError}
                stretch
                constraintText="Optional. Contact email for customer admin."
              >
                <Input
                  value={adminEmail}
                  onChange={({ detail }) => setAdminEmail(detail.value)}
                  placeholder="e.g., admin@acme.com"
                  type="email"
                />
              </FormField>
            </ColumnLayout>

            <ColumnLayout columns={2}>
              <FormField
                label="Notification email"
                errorText={notificationEmailError}
                stretch
                constraintText="Optional. Customer-managed group email for CloudiQS notifications."
              >
                <Input
                  value={notificationEmail}
                  onChange={({ detail }) => setNotificationEmail(detail.value)}
                  placeholder="e.g., security-team@acme.com"
                  type="email"
                />
              </FormField>

              <FormField
                label="Customer notifications"
                stretch
                description="Enable CloudiQS customer notification emails for this customer."
              >
                <Checkbox
                  checked={notificationsEnabled}
                  onChange={({ detail }) => setNotificationsEnabled(detail.checked)}
                >
                  Enable customer notifications
                </Checkbox>
              </FormField>
            </ColumnLayout>

            <FormField
              label="Status"
              stretch
            >
              <Select
                selectedOption={status}
                onChange={({ detail }) => setStatus(detail.selectedOption)}
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
              />
            </FormField>

            <FormField
              label="Permission Set"
              stretch
              description="Determines the level of access CloudIQS MSP will have to the customer's AWS account."
            >
              <Select
                selectedOption={permissionSet}
                onChange={({ detail }) => setPermissionSet(detail.selectedOption)}
                options={[
                  { label: "Read-Only", value: "read-only" },
                  { label: "Admin", value: "admin" },
                  { label: "Custom", value: "custom" },
                ]}
              />
            </FormField>

            <FormField
              label="AWS Account IDs"
              stretch
              description="Enter the customer's AWS Account IDs (12-digit numbers). These are NOT from your Organization — they are provided by the customer."
              errorText={accountIdError}
            >
              <SpaceBetween size="xs">
                <SpaceBetween direction="horizontal" size="xs">
                  <Input
                    value={accountIdInput}
                    onChange={({ detail }) => {
                      setAccountIdInput(detail.value);
                      setAccountIdError("");
                    }}
                    onKeyDown={({ detail }) => {
                      if (detail.key === 'Enter') {
                        addAccountId();
                      }
                    }}
                    placeholder="e.g., 111122223333"
                    type="text"
                  />
                  <Button onClick={addAccountId} disabled={!accountIdInput.trim()}>
                    Add
                  </Button>
                </SpaceBetween>
                {selectedAccounts.length > 0 && (
                  <TokenGroup
                    items={selectedAccounts}
                    onDismiss={({ detail: { itemIndex } }) => {
                      setSelectedAccounts(selectedAccounts.filter((_, i) => i !== itemIndex));
                    }}
                  />
                )}
              </SpaceBetween>
            </FormField>

            <FormField
              label="Approver Groups"
              stretch
              description="Select IAM Identity Center groups that can approve requests for this customer's accounts."
            >
              {groupsLoading ? (
                <Spinner />
              ) : (
                <Multiselect
                  selectedOptions={selectedApproverGroups}
                  onChange={({ detail }) =>
                    setSelectedApproverGroups(detail.selectedOptions)
                  }
                  options={approverGroups}
                  placeholder="Choose approver groups"
                  filteringType="auto"
                />
              )}
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        onDismiss={() => setEditModalVisible(false)}
        visible={editModalVisible}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setEditModalVisible(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleEditCustomer}
                loading={loading}
              >
                Save changes
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Edit customer"
      >
        <Form>
          <SpaceBetween size="m">
            <FormField
              label="Customer name"
              errorText={nameError}
              stretch
              constraintText="Required. The name of the customer organization."
            >
              <Input
                value={customerName}
                onChange={({ detail }) => setCustomerName(detail.value)}
                placeholder="e.g., Acme Corporation"
              />
            </FormField>

            <FormField
              label="Description"
              stretch
              constraintText="Optional. A brief description of the customer."
            >
              <Textarea
                value={customerDescription}
                onChange={({ detail }) => setCustomerDescription(detail.value)}
                placeholder="e.g., Primary customer for product X"
              />
            </FormField>

            <ColumnLayout columns={2}>
              <FormField
                label="Admin name"
                stretch
                constraintText="Optional. Primary contact name."
              >
                <Input
                  value={adminName}
                  onChange={({ detail }) => setAdminName(detail.value)}
                  placeholder="e.g., John Doe"
                />
              </FormField>

              <FormField
                label="Admin email"
                errorText={emailError}
                stretch
                constraintText="Optional. Contact email for customer admin."
              >
                <Input
                  value={adminEmail}
                  onChange={({ detail }) => setAdminEmail(detail.value)}
                  placeholder="e.g., admin@acme.com"
                  type="email"
                />
              </FormField>
            </ColumnLayout>

            <ColumnLayout columns={2}>
              <FormField
                label="Notification email"
                errorText={notificationEmailError}
                stretch
                constraintText="Optional. Customer-managed group email for CloudiQS notifications."
              >
                <Input
                  value={notificationEmail}
                  onChange={({ detail }) => setNotificationEmail(detail.value)}
                  placeholder="e.g., security-team@acme.com"
                  type="email"
                />
              </FormField>

              <FormField
                label="Customer notifications"
                stretch
                description="Enable CloudiQS customer notification emails for this customer."
              >
                <Checkbox
                  checked={notificationsEnabled}
                  onChange={({ detail }) => setNotificationsEnabled(detail.checked)}
                >
                  Enable customer notifications
                </Checkbox>
              </FormField>
            </ColumnLayout>

            <FormField
              label="Status"
              stretch
            >
              <Select
                selectedOption={status}
                onChange={({ detail }) => setStatus(detail.selectedOption)}
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
              />
            </FormField>

            <FormField
              label="Permission Set"
              stretch
              description="Determines the level of access CloudIQS MSP will have to the customer's AWS account."
            >
              <Select
                selectedOption={permissionSet}
                onChange={({ detail }) => setPermissionSet(detail.selectedOption)}
                options={[
                  { label: "Read-Only", value: "read-only" },
                  { label: "Admin", value: "admin" },
                  { label: "Custom", value: "custom" },
                ]}
              />
            </FormField>

            <FormField
              label="AWS Account IDs"
              stretch
              description="Enter the customer's AWS Account IDs (12-digit numbers). These are NOT from your Organization — they are provided by the customer."
              errorText={accountIdError}
            >
              <SpaceBetween size="xs">
                <SpaceBetween direction="horizontal" size="xs">
                  <Input
                    value={accountIdInput}
                    onChange={({ detail }) => {
                      setAccountIdInput(detail.value);
                      setAccountIdError("");
                    }}
                    onKeyDown={({ detail }) => {
                      if (detail.key === 'Enter') {
                        addAccountId();
                      }
                    }}
                    placeholder="e.g., 111122223333"
                    type="text"
                  />
                  <Button onClick={addAccountId} disabled={!accountIdInput.trim()}>
                    Add
                  </Button>
                </SpaceBetween>
                {selectedAccounts.length > 0 && (
                  <TokenGroup
                    items={selectedAccounts}
                    onDismiss={({ detail: { itemIndex } }) => {
                      setSelectedAccounts(selectedAccounts.filter((_, i) => i !== itemIndex));
                    }}
                  />
                )}
              </SpaceBetween>
            </FormField>

            <FormField
              label="Approver Groups"
              stretch
              description="Select IAM Identity Center groups that can approve requests for this customer's accounts."
            >
              {groupsLoading ? (
                <Spinner />
              ) : (
                <Multiselect
                  selectedOptions={selectedApproverGroups}
                  onChange={({ detail }) =>
                    setSelectedApproverGroups(detail.selectedOptions)
                  }
                  options={approverGroups}
                  placeholder="Choose approver groups"
                  filteringType="auto"
                />
              )}
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setDeleteModalVisible(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteCustomer}
                loading={loading}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete customer(s)"
      >
        <Box>
          Are you sure you want to delete{" "}
          {selectedCustomer.length === 1
            ? `customer "${selectedCustomer[0].name}"`
            : `${selectedCustomer.length} customers`}
          ?
        </Box>
      </Modal>

      {/* Verify Role Modal */}
      <Modal
        onDismiss={() => setVerifyModalVisible(false)}
        visible={verifyModalVisible}
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setVerifyModalVisible(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleVerifyRole}
                loading={verifying}
              >
                Verify role
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Verify customer role"
      >
        <SpaceBetween size="m">
          {selectedCustomer.length === 1 && (
            <Box>
              <Box variant="p">
                Verify that the IAM role has been created in <strong>{selectedCustomer[0].name}</strong>'s AWS account.
              </Box>
              {selectedCustomer[0].roleStatus && (
                <Box margin={{ top: "s" }}>
                  <strong>Current status: </strong>
                  <RoleStatusIndicator roleStatus={selectedCustomer[0].roleStatus} />
                </Box>
              )}
            </Box>
          )}
          
          <FormField
            label="Role ARN"
            errorText={roleArnError}
            stretch
            constraintText={`The ARN of the IAM role created in the customer's account. Format: arn:aws:iam::<account-id>:role/${MSP_ROLE_NAME}`}
          >
            <Input
              value={roleArnInput}
              onChange={({ detail }) => {
                setRoleArnInput(detail.value);
                setRoleArnError("");
              }}
              placeholder={`arn:aws:iam::111122223333:role/${MSP_ROLE_NAME}`}
            />
          </FormField>
          
          {verifyResult && (
            <Alert type={verifyResult.success ? "success" : "error"}>
              {verifyResult.success
                ? `Role verified successfully! The role is now established and ready for access requests.`
                : `Verification failed: ${verifyResult.error || 'Unknown error'}. Please ensure the customer has deployed the CloudFormation template.`
              }
            </Alert>
          )}
        </SpaceBetween>
      </Modal>
    </>
  );
}

export default Customers;
