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
  const [allAccounts, setAllAccounts] = useState([]);

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
  const policyUsernameRef = useRef("");

  const history = useHistory();
  
  const normalizeAccountId = (id) => String(id ?? "").trim();

  function concatenateAccounts(data) {
    let allAccounts = data.map((item) => item.accounts);
    allAccounts = [].concat.apply([], allAccounts);

    let uniqueAccounts = new Set();
    allAccounts.forEach((account) => {
      uniqueAccounts.add(JSON.stringify(account));
    });

    return Array.from(uniqueAccounts).map((account) => JSON.parse(account));
  }

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
    item.forEach((data) => {
      data.accounts.forEach((account) => {
        if (account.id === accountId) {
          permissionData = permissionData.concat(data.permissions);
        }
      });
    });
    console.log("ROLE OPTIONS for account", accountId, ":", JSON.stringify(permissionData, null, 2));
    setPermissions(concatenatePermissions(permissionData));
    return permissionData;
  }

  function applyPolicyData(policyData) {
    const safePolicyData = Array.isArray(policyData) ? policyData : [];
    console.log("POLICY DATA received:", JSON.stringify(safePolicyData, null, 2));
    setItem(safePolicyData);
    const fetchedAccounts = concatenateAccounts(safePolicyData);
    setAllAccounts(fetchedAccounts);
    if (selectedCustomer?.value) {
      filterAccountsByCustomer(selectedCustomer.value, fetchedAccounts);
    } else {
      setAccounts(fetchedAccounts);
    }
    setAccountStatus("finished");
    setPermissionStatus("finished");
  }

  const getPolicy = async () => {
    let args = {
      userId: props.userId,
      groupIds: props.groupIds,
    };
    const data = await fetchPolicy(args);
    policyRequestIdRef.current = data?.id || null;
    policyUsernameRef.current = (data?.username || "").toLowerCase();
    applyPolicyData(data?.policy);
  };

  function publishEvent() {
    const subscription = API.graphql(graphqlOperation(onPublishPolicy)).subscribe({
      next: (result) => {
        const payload = result?.value?.data?.onPublishPolicy;
        console.log("SUBSCRIPTION received:", JSON.stringify(payload, null, 2));
        if (!payload) return;

        // Ignore unrelated policy broadcasts. onPublishPolicy is global,
        // so we must correlate by both request id and username.
        if (!policyRequestIdRef.current || !policyUsernameRef.current) return;
        const eventUsername = (payload.username || "").toLowerCase();
        if (
          payload.id !== policyRequestIdRef.current ||
          eventUsername !== policyUsernameRef.current
        ) {
          return;
        }

        const policy = payload.policy;
        if (policy?.length > 0) applyPolicyData(policy);
      },
      error: (error) => {
        console.warn("SUBSCRIPTION error:", error);
      }
    });
    
    // Return the subscription to allow external cleanup if needed
    return subscription;
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

  function filterAccountsByCustomer(customerId, sourceAccounts = allAccounts) {
    if (!customerId) {
      // Show all accounts if no customer selected
      setAccounts(sourceAccounts);
    } else {
      // Find the customer and get their accountIds
      const customer = customers.find(c => c.id === customerId);
      if (customer && customer.accountIds && customer.accountIds.length > 0) {
        // Filter accounts by checking if account.id is in customer.accountIds
        const customerAccountIds = new Set(
          customer.accountIds.map((id) => normalizeAccountId(id))
        );
        const filtered = sourceAccounts.filter(acc => 
          customerAccountIds.has(normalizeAccountId(acc.id))
        );
        setAccounts(filtered);
      } else {
        // No accounts mapped to this customer
        setAccounts([]);
      }
    }
  }

  useEffect(() => {
    setEmail(props.user);
    getSettings();
    props.addNotification([]);
    getMgmtPs();
    setTime(moment().format());
    fetchCustomers();

    // IMPORTANT: Set up subscription FIRST, then wait before triggering the
    // Lambda so the WebSocket is connected when the response arrives.
    const subscription = publishEvent();
    const timer = setTimeout(() => {
      getPolicy();
    }, 1500);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getRequestErrorMessage(error) {
    if (!error) return "Unknown error";
    if (error.errors && error.errors.length > 0 && error.errors[0].message) {
      return error.errors[0].message;
    }
    if (error.message) return error.message;
    return "Unknown error";
  }

  async function sendRequest() {
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
    try {
      const requestId = await requestTeam(data);
      if (!requestId) {
        throw new Error("Request was not created.");
      }
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
    } catch (error) {
      setSubmitLoading(false);
      props.addNotification([
        {
          type: "error",
          content: `Failed to create request: ${getRequestErrorMessage(error)}`,
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
    }
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
    } else if (
      role.value &&
      !/^arn:aws:sso:::permissionSet\/ssoins-[A-Za-z0-9-.]{16}\/ps-[A-Za-z0-9-.]{16}$/.test(
        role.value
      )
    ) {
      setRoleError("Select a valid IAM Identity Center permission set");
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

  function getCustomerForAccount(accountId) {
    const normalizedAccountId = normalizeAccountId(accountId);
    return customers.find(
      (customer) =>
        Array.isArray(customer.accountIds) &&
        customer.accountIds.some(
          (id) => normalizeAccountId(id) === normalizedAccountId
        ) &&
        (customer.roleStatus === "established" || !customer.roleStatus)
    );
  }

  async function checkApprovalAndApproverGroups(account, role) {
    if (await checkApprovalNotRequired(account, role)) {
      return true;
    }
    const customer =
      customers.find((c) => c.id === customerId) || getCustomerForAccount(account);
    const approverGroupIds = customer?.approverGroupIds || [];
    if (!approverGroupIds.length) {
      return false;
    }
    const data = await getGroupMemberships(approverGroupIds);
    const requesterIsApprover = checkGroupMembership(
      props.groupIds,
      approverGroupIds
    );
    // If requester is in an approver group, ensure at least one additional approver exists.
    const approverGroupMembersRequired = requesterIsApprover ? 2 : 1;
    return (data?.members?.length || 0) >= approverGroupMembersRequired;
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
