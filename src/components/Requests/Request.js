// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import Form from "@awsui/components-react/form";
import FormField from "@awsui/components-react/form-field";
import Input from "@awsui/components-react/input";
import Select from "@awsui/components-react/select";
import Container from "@awsui/components-react/container";
import Header from "@awsui/components-react/header";
import SpaceBetween from "@awsui/components-react/space-between";
import Button from "@awsui/components-react/button";
import Textarea from "@awsui/components-react/textarea";
import moment from "moment";
import { DatePicker } from "antd";
import "../../index.css";
import React, { useState, useEffect, useRef } from "react";
import {
  getGroupMemberships,
  requestTeam,
  fetchApprovers,
  fetchOU,
  getSetting,
  getMgmtAccountPs,
  fetchPolicy,
} from "../Shared/RequestService";
import { useHistory } from "react-router-dom";
import { API, graphqlOperation } from "aws-amplify";
import { onPublishPolicy } from "../../graphql/subscriptions";
import { listCustomers } from "../../graphql/queries";
import params from "../../parameters.json";

function Request(props) {
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

  const [email, setEmail] = useState("");

  const [item, setItem] = useState([]);

  const [duration, setDuration] = useState("");
  const [durationError, setDurationError] = useState("");

  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState("");

  const [role, setRole] = useState([]);
  const [roleError, setRoleError] = useState("");

  const [account, setAccount] = useState([]);
  const [accountError, setAccountError] = useState("");

  const [time, setTime] = useState("");
  const [timeError, setTimeError] = useState("");

  const [ticketNo, setTicketNo] = useState("");
  const [ticketError, setTicketError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountStatus, setAccountStatus] = useState("loading");

  const [permissions, setPermissions] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState("loading");

  const [submitLoading, setSubmitLoading] = useState(false);

  const [mgmtPs, setMgmtPs] = useState([]);

  const [maxDuration, setMaxDuration] = useState(9);
  const [ticketRequired, setTicketRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const policyRequestIdRef = useRef(null);

  const history = useHistory();

  function concatenatePermissions(data) {
    let uniquePermissions = new Set();
    data.forEach((permission) => {
      uniquePermissions.add(JSON.stringify(permission));
    });

    return Array.from(uniquePermissions).map((permission) =>
      JSON.parse(permission)
    );
  }

  async function getDuration(accountId) {
    setDuration("");
    item.forEach((data) => {
      data.accounts.forEach((account, index) => {
        if (account.id === accountId) {
          setMaxDuration(data.duration);
        }
      });
    });
  }

  async function getPermissions(accountId) {
    let permissionData = [];
    setRole([]);

    // Check if this account belongs to a multi-tenant customer
    const customer = customers.find(c =>
      c.accountIds && c.accountIds.map(String).includes(String(accountId)) &&
      c.roleStatus === 'established'
    );

    if (customer) {
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
          availableRoles = MULTI_TENANT_ROLES.filter(r => r.name !== 'AdministratorAccess');
          break;
        default:
          availableRoles = MULTI_TENANT_ROLES.filter(r => r.name === 'ReadOnlyAccess');
      }
      setPermissions(availableRoles);
      setPermissionStatus("finished");
    } else {
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

  const getPolicy = async () => {
    let args = {
      userId: props.userId,
      groupIds: props.groupIds,
    };
    const response = await fetchPolicy(args);
    if (response?.id) {
      policyRequestIdRef.current = response.id;
    } else {
      setAccountStatus("error");
      setPermissionStatus("error");
    }
  };

  function publishEvent() {
    const subscription = API.graphql(graphqlOperation(onPublishPolicy)).subscribe({
      next: (result) => {
        const payload = result?.value?.data?.onPublishPolicy;
        if (!payload) {
          return;
        }

        // Ignore policy events that do not belong to this page request.
        if (!policyRequestIdRef.current || payload.id !== policyRequestIdRef.current) {
          return;
        }

        const policy = payload.policy || [];
        if (policy?.length > 0) {
          setItem(policy);
          setAccounts([]);
        } else {
          setItem([]);
          setAccounts([]);
        }
        setAccountStatus("finished");
        setPermissionStatus("finished");
        subscription.unsubscribe();
      },
      error: (error) => {
        console.warn(error);
        subscription.unsubscribe();
      }
    });
    
    // Return the subscription to allow external cleanup if needed
    return subscription;
  }

  async function fetchCustomers() {
    setCustomersLoading(true);
    try {
      const result = await API.graphql(graphqlOperation(listCustomers));
      const customerList = result.data.listCustomers.items || [];
      // Only show active customers with established roles
      const activeCustomers = customerList.filter(
        c => (c.status === 'active' || !c.status) && 
             (c.roleStatus === 'established' || !c.roleStatus) // Allow legacy customers without roleStatus
      );
      setCustomers(activeCustomers);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setCustomersLoading(false);
    }
  }

  function filterAccountsByCustomer(customerId) {
    // Customer-scoped mapping: account dropdown source comes from customer.accountIds.
    if (!customerId) {
      setAccounts([]);
      return;
    }

    const customer = customers.find((c) => c.id === customerId);
    if (!customer || !customer.accountIds || customer.accountIds.length < 1) {
      setAccounts([]);
      return;
    }

    const customerScopedAccounts = customer.accountIds.map((id) => ({
      id: String(id),
      name: String(id),
      customerId: customer.id,
      customerName: customer.name || "",
    }));

    setAccounts(customerScopedAccounts);
  }

  function getSettings() {
    getSetting("settings").then((data) => {
      if (data !== null) {
        setMaxDuration(parseInt(data.duration));
        setTicketRequired(data.ticketNo);
        setApprovalRequired(data.approval);
      }
    });
  }

  function getMgmtPs() {
    getMgmtAccountPs().then((data) => {
      setMgmtPs(data);
    });
  }

  useEffect(() => {
    setEmail(props.user);
    getSettings();
    props.addNotification([]);
    getMgmtPs();
    setTime(moment().format());
    // Subscribe first so we do not miss the publish event.
    const subscription = publishEvent();
    // Trigger async policy generation after subscription starts.
    getPolicy();
    fetchCustomers();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendRequest() {
    const data = {
      accountId: account.value,
      accountName: account.label,
      role: role.label,
      roleId: role.value,
      duration: duration,
      startTime: time,
      justification: justification,
      ticketNo: ticketNo,
      customerId: customerId || null,
      customerName: customerName || null,
    };
    requestTeam(data).then(() => {
      setSubmitLoading(false);
      props.addNotification([
        {
          type: "success",
          content: "Request created successfully",
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
      history.push("/requests/view");
      props.setActiveHref("/requests/view");
    });
  }

  function handleCancel() {
    history.push("/");
    props.setActiveHref("/");
    props.addNotification([]);
  }

  function sendError() {
    props.addNotification([
      {
        type: "error",
        content: `No approver for Account - ${account.label}`,
        dismissible: true,
        onDismiss: () => props.addNotification([]),
      },
    ]);
    setSubmitLoading(false);
  }

  async function validate() {
    let error = false;
    const roleValue = role?.value;
    const isMtRole = typeof roleValue === "string" && roleValue.startsWith("mt-");

    // Model B hardening: mt-* requests require customer context to be loaded and selected.
    if (isMtRole) {
      if (customersLoading) {
        setRoleError("Customers are still loading. Please wait and try again.");
        error = true;
      }
      if (!selectedCustomer?.value || !customerId) {
        setRoleError("Select a customer for multi-tenant (mt-*) access.");
        error = true;
      }
    }

    if (
      !duration ||
      isNaN(duration) ||
      Number(duration) > Number(maxDuration) ||
      Number(duration) < 1
    ) {
      setDurationError(`Enter number between 1-${maxDuration}`);
      error = true;
    }
    if (role.length < 1) {
      setRoleError("Select a role");
      error = true;
    }
    if (
      params.DeploymentType === "delegated" &&
      role &&
      mgmtPs.permissions.includes(role.value)
    ) {
      setRoleError(
        "Permission set is assigned to management account and cannot be requested"
      );
      error = true;
    }
    if (!account.label) {
      setAccountError("Select an account");
      error = true;
    }
    if (!time) {
      setTimeError("Select start date");
      error = true;
    }
    if (!justification || !/[\p{L}\p{N}]/u.test(justification[0])) {
      setJustificationError("Enter valid business justification");
      error = true;
    }
    if ((!ticketNo && ticketRequired) || !/^[a-zA-Z0-9]+$/.test(ticketNo[0])) {
      setTicketError("Enter valid change management ticket number");
      error = true;
    }
    return error;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitLoading(true);
    const isValid = await validate();
    if (!isValid) {
      const shouldSendRequest =
        !approvalRequired ||
        (await checkApprovalAndApproverGroups(account.value, role.value));
      shouldSendRequest ? sendRequest() : sendError();
    } else {
      setSubmitLoading(false);
    }
  }

  async function checkApprovalNotRequired(account, role) {
    let approvalNotRequired = false;
    for (const eligibility of item) {
      for (const acct of eligibility.accounts) {
        if (acct.id === account) {
          for (const perm of eligibility.permissions) {
            if (perm.id === role) {
              if (!eligibility.approvalRequired) {
                approvalNotRequired = true;
              }
            }
          }
        }
      }
    }
    return approvalNotRequired;
  }

  function checkGroupMembership(groupIds, groupsIds) {
    for (const groupId of groupIds) {
      if (groupsIds.includes(groupId)) {
        return true;
      }
    }
    return false;
  }

  async function hasSufficientApprovers(groupIds) {
    if (!Array.isArray(groupIds) || groupIds.length < 1) {
      return false;
    }

    const data = await getGroupMemberships(groupIds);
    const requesterIsApprover = checkGroupMembership(props.groupIds, groupIds);
    // If requester is also an approver, at least one additional approver must exist.
    const approverGroupMembersRequired = requesterIsApprover ? 2 : 1;

    return data.members.length >= approverGroupMembersRequired;
  }

  async function checkApprovalAndApproverGroups(account, role) {
    const isMtRole = typeof role === "string" && role.startsWith("mt-");

    // Model B: mt-* approvals are customer-scoped only.
    if (isMtRole) {
      const scopedCustomer = customers.find((c) => c.id === customerId);
      if (!scopedCustomer) {
        return false;
      }
      return hasSufficientApprovers(scopedCustomer.approverGroupIds || []);
    }

    // Non-mt roles keep the existing legacy eligibility + org approver checks.
    if (await checkApprovalNotRequired(account, role)) {
      return true;
    }

    const account_approvers = await fetchApprovers(account, "Account");
    if (account_approvers) {
      if (await hasSufficientApprovers(account_approvers.groupIds)) {
        return true;
      }
    }
    const ou = await fetchOU(account);
    const ou_approvers = await fetchApprovers(ou.Id, "OU");
    if (ou_approvers) {
      if (await hasSufficientApprovers(ou_approvers.groupIds)) {
        return true;
      }
    }
    return false;
  }

  return (
    <div className="container">
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              onClick={handleSubmit}
              className="buttons"
              loading={submitLoading}
            >
              Submit
            </Button>
          </SpaceBetween>
        }
      >
        <Container
          header={
            <Header
              variant="h2"
              description="Request temporary elevated access"
            >
              Elevated access request
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              label="Email"
              stretch
              description="Elevated access requester username"
            >
              <Input value={email} type="email" />
            </FormField>
            <FormField
              label="Customer"
              stretch
              description="Select customer to filter accounts"
            >
              <Select
                statusType={customersLoading ? "loading" : "finished"}
                placeholder="Select a customer (optional)"
                loadingText="Loading customers"
                filteringType="auto"
                empty="No customers found"
                options={[
                  { label: "All accounts", value: "" },
                  ...customers.map((customer) => ({
                    label: customer.name,
                    value: customer.id,
                    description: `${customer.accountIds?.length || 0} account(s)`,
                  }))
                ]}
                selectedOption={selectedCustomer}
                onChange={(event) => {
                  const selected = event.detail.selectedOption;
                  setSelectedCustomer(selected);
                  
                  // Clear account selection when customer changes
                  setAccount([]);
                  setRole([]);
                  setPermissions([]);
                  
                  // Update customer info
                  if (selected.value) {
                    setCustomerId(selected.value);
                    setCustomerName(selected.label);
                    filterAccountsByCustomer(selected.value);
                  } else {
                    setCustomerId("");
                    setCustomerName("");
                    filterAccountsByCustomer(null);
                  }
                }}
                selectedAriaLabel="selected"
              />
            </FormField>
            <FormField
              label="Account"
              stretch
              description="Target account for elevated access"
              errorText={accountError}
            >
              <Select
                statusType={accountStatus}
                placeholder="Select an account"
                loadingText="Loading accounts"
                filteringType="auto"
                empty="No eligible accounts found"
                options={accounts.map((account) => ({
                  label: account.name,
                  value: account.id,
                  description: account.id,
                  tags: account.customerId ? [`Customer: ${account.customerName || account.customerId}`] : undefined,
                }))}
                selectedOption={account}
                onChange={(event) => {
                  setAccountError();
                  const selected = event.detail.selectedOption;
                  setAccount(selected);
                  
                  // Extract customer info from the selected account
                  // Customer dropdown takes precedence over account's customer
                  if (!selectedCustomer || !selectedCustomer.value) {
                    const selectedAccountData = accounts.find(acc => acc.id === selected.value);
                    if (selectedAccountData && selectedAccountData.customerId) {
                      setCustomerId(selectedAccountData.customerId);
                      setCustomerName(selectedAccountData.customerName || "");
                    } else {
                      setCustomerId("");
                      setCustomerName("");
                    }
                  }
                  
                  getPermissions(selected.value);
                  getDuration(selected.value);
                }}
                selectedAriaLabel="selected"
              />
            </FormField>
            {customerName && selectedCustomer && selectedCustomer.value && (
              <FormField
                label="Filtered by Customer"
                stretch
                description="Accounts are filtered for the selected customer"
              >
                <Input value={customerName} readOnly />
              </FormField>
            )}
            <FormField
              label="Role"
              stretch
              description="Requested permission set and associated role"
              errorText={roleError}
            >
              <Select
                statusType={permissionStatus}
                placeholder="Select a role"
                loadingText="Loading permissions"
                filteringType="auto"
                empty="No eligible permissions found"
                options={permissions.map((permission) => ({
                  label: permission.name,
                  value: permission.id,
                }))}
                selectedOption={role}
                onChange={(event) => {
                  setRoleError();
                  setRole(event.detail.selectedOption);
                }}
                selectedAriaLabel="selected"
              />
            </FormField>
            <FormField
              label="Start time"
              stretch
              description="Start date and time for elevated access"
              errorText={timeError}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                defaultValue={moment()}
                // disabledDate={disabledDate}
                onChange={(event) => {
                  setTimeError();
                  if (event) {
                    setTime(event._d);
                    console.log(event._d);
                  }
                }}
              />
            </FormField>
            <FormField
              label="Duration"
              stretch
              description="Number of hours for which elevated access is required - Note: This is different from the session duration configured for requested permission set/role"
              errorText={durationError}
              placeholder={`Enter number between 1-${maxDuration}`}
            >
              <Input
                value={duration}
                onChange={(event) => {
                  setDurationError();
                  Number(event.detail.value) > Number(maxDuration)
                    ? setDurationError(
                        `Enter a number between 1 and ${maxDuration}`
                      )
                    : setDuration(event.detail.value);
                }}
                type="number"
              />
            </FormField>
            <FormField
              label="Ticket no"
              stretch
              description="Elevated request ticket system number"
              errorText={ticketError}
            >
              <Input
                value={ticketNo}
                onChange={(event) => {
                  setTicketError();
                  setTicketNo(event.detail.value);
                }}
              />
            </FormField>
            <FormField
              label="Justification"
              stretch
              description="Business justification for requesting elevated access"
              errorText={justificationError}
            >
              <Textarea
                onChange={({ detail }) => {
                  setJustificationError();
                  setJustification(detail.value);
                }}
                value={justification}
                ariaRequired
                placeholder="Business Justification for requesting elevated access"
              />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </div>
  );
}

export default Request;
