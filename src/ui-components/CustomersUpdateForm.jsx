/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

/* eslint-disable */
import * as React from "react";
import {
  Badge,
  Button,
  Divider,
  Flex,
  Grid,
  Icon,
  ScrollView,
  Text,
  TextAreaField,
  TextField,
  useTheme,
} from "@aws-amplify/ui-react";
import { fetchByPath, getOverrideProps, validateField } from "./utils";
import { API } from "aws-amplify";
import { getCustomers } from "../graphql/queries";
import { updateCustomers } from "../graphql/mutations";
function ArrayField({
  items = [],
  onChange,
  label,
  inputFieldRef,
  children,
  hasError,
  setFieldValue,
  currentFieldValue,
  defaultFieldValue,
  lengthLimit,
  getBadgeText,
  runValidationTasks,
  errorMessage,
}) {
  const labelElement = <Text>{label}</Text>;
  const {
    tokens: {
      components: {
        fieldmessages: { error: errorStyles },
      },
    },
  } = useTheme();
  const [selectedBadgeIndex, setSelectedBadgeIndex] = React.useState();
  const [isEditing, setIsEditing] = React.useState();
  React.useEffect(() => {
    if (isEditing) {
      inputFieldRef?.current?.focus();
    }
  }, [isEditing]);
  const removeItem = async (removeIndex) => {
    const newItems = items.filter((value, index) => index !== removeIndex);
    await onChange(newItems);
    setSelectedBadgeIndex(undefined);
  };
  const addItem = async () => {
    const { hasError } = runValidationTasks();
    if (
      currentFieldValue !== undefined &&
      currentFieldValue !== null &&
      currentFieldValue !== "" &&
      !hasError
    ) {
      const newItems = [...items];
      if (selectedBadgeIndex !== undefined) {
        newItems[selectedBadgeIndex] = currentFieldValue;
        setSelectedBadgeIndex(undefined);
      } else {
        newItems.push(currentFieldValue);
      }
      await onChange(newItems);
      setIsEditing(false);
    }
  };
  const arraySection = (
    <React.Fragment>
      {!!items?.length && (
        <ScrollView height="inherit" width="inherit" maxHeight={"7rem"}>
          {items.map((value, index) => {
            return (
              <Badge
                key={index}
                style={{
                  cursor: "pointer",
                  alignItems: "center",
                  marginRight: 3,
                  marginTop: 3,
                  backgroundColor:
                    index === selectedBadgeIndex ? "#B8CEF9" : "",
                }}
                onClick={() => {
                  setSelectedBadgeIndex(index);
                  setFieldValue(items[index]);
                  setIsEditing(true);
                }}
              >
                {getBadgeText ? getBadgeText(value) : value.toString()}
                <Icon
                  style={{
                    cursor: "pointer",
                    paddingLeft: 3,
                    width: 20,
                    height: 20,
                  }}
                  viewBox={{ width: 20, height: 20 }}
                  paths={[
                    {
                      d: "M10 10l5.09-5.09L10 10l5.09 5.09L10 10zm0 0L4.91 4.91 10 10l-5.09 5.09L10 10z",
                      stroke: "black",
                    },
                  ]}
                  ariaLabel="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeItem(index);
                  }}
                />
              </Badge>
            );
          })}
        </ScrollView>
      )}
      <Divider orientation="horizontal" marginTop={5} />
    </React.Fragment>
  );
  if (lengthLimit !== undefined && items.length >= lengthLimit && !isEditing) {
    return (
      <React.Fragment>
        {labelElement}
        {arraySection}
      </React.Fragment>
    );
  }
  return (
    <React.Fragment>
      {labelElement}
      {isEditing && children}
      {!isEditing ? (
        <>
          <Button
            onClick={() => {
              setIsEditing(true);
            }}
          >
            Add item
          </Button>
          {errorMessage && hasError && (
            <Text color={errorStyles.color} fontSize={errorStyles.fontSize}>
              {errorMessage}
            </Text>
          )}
        </>
      ) : (
        <Flex justifyContent="flex-end">
          {(currentFieldValue || isEditing) && (
            <Button
              children="Cancel"
              type="button"
              size="small"
              onClick={() => {
                setFieldValue(defaultFieldValue);
                setIsEditing(false);
                setSelectedBadgeIndex(undefined);
              }}
            ></Button>
          )}
          <Button size="small" variation="link" onClick={addItem}>
            {selectedBadgeIndex !== undefined ? "Save" : "Add"}
          </Button>
        </Flex>
      )}
      {arraySection}
    </React.Fragment>
  );
}
export default function CustomersUpdateForm(props) {
  const {
    id: idProp,
    customers: customersModelProp,
    onSuccess,
    onError,
    onSubmit,
    onValidate,
    onChange,
    overrides,
    ...rest
  } = props;
  const initialValues = {
    name: "",
    description: "",
    accountIds: [],
    approverGroupIds: [],
    adminEmail: "",
    adminName: "",
    status: "",
    settings: "",
    createdAt: "",
    modifiedBy: "",
    metadata: "",
    permissionSet: "",
    roleStatus: "",
    roleArn: "",
    externalId: "",
    cloudFormationTemplate: "",
    invitationToken: "",
    invitationSentAt: "",
    invitationExpiresAt: "",
    approvedAt: "",
    roleEstablishedAt: "",
    lastRoleVerification: "",
    roleVerificationError: "",
  };
  const [name, setName] = React.useState(initialValues.name);
  const [description, setDescription] = React.useState(
    initialValues.description
  );
  const [accountIds, setAccountIds] = React.useState(initialValues.accountIds);
  const [approverGroupIds, setApproverGroupIds] = React.useState(
    initialValues.approverGroupIds
  );
  const [adminEmail, setAdminEmail] = React.useState(initialValues.adminEmail);
  const [adminName, setAdminName] = React.useState(initialValues.adminName);
  const [status, setStatus] = React.useState(initialValues.status);
  const [settings, setSettings] = React.useState(initialValues.settings);
  const [createdAt, setCreatedAt] = React.useState(initialValues.createdAt);
  const [modifiedBy, setModifiedBy] = React.useState(initialValues.modifiedBy);
  const [metadata, setMetadata] = React.useState(initialValues.metadata);
  const [permissionSet, setPermissionSet] = React.useState(
    initialValues.permissionSet
  );
  const [roleStatus, setRoleStatus] = React.useState(initialValues.roleStatus);
  const [roleArn, setRoleArn] = React.useState(initialValues.roleArn);
  const [externalId, setExternalId] = React.useState(initialValues.externalId);
  const [cloudFormationTemplate, setCloudFormationTemplate] = React.useState(
    initialValues.cloudFormationTemplate
  );
  const [invitationToken, setInvitationToken] = React.useState(
    initialValues.invitationToken
  );
  const [invitationSentAt, setInvitationSentAt] = React.useState(
    initialValues.invitationSentAt
  );
  const [invitationExpiresAt, setInvitationExpiresAt] = React.useState(
    initialValues.invitationExpiresAt
  );
  const [approvedAt, setApprovedAt] = React.useState(initialValues.approvedAt);
  const [roleEstablishedAt, setRoleEstablishedAt] = React.useState(
    initialValues.roleEstablishedAt
  );
  const [lastRoleVerification, setLastRoleVerification] = React.useState(
    initialValues.lastRoleVerification
  );
  const [roleVerificationError, setRoleVerificationError] = React.useState(
    initialValues.roleVerificationError
  );
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    const cleanValues = customersRecord
      ? { ...initialValues, ...customersRecord }
      : initialValues;
    setName(cleanValues.name);
    setDescription(cleanValues.description);
    setAccountIds(cleanValues.accountIds ?? []);
    setCurrentAccountIdsValue("");
    setApproverGroupIds(cleanValues.approverGroupIds ?? []);
    setCurrentApproverGroupIdsValue("");
    setAdminEmail(cleanValues.adminEmail);
    setAdminName(cleanValues.adminName);
    setStatus(cleanValues.status);
    setSettings(
      typeof cleanValues.settings === "string" || cleanValues.settings === null
        ? cleanValues.settings
        : JSON.stringify(cleanValues.settings)
    );
    setCreatedAt(cleanValues.createdAt);
    setModifiedBy(cleanValues.modifiedBy);
    setMetadata(
      typeof cleanValues.metadata === "string" || cleanValues.metadata === null
        ? cleanValues.metadata
        : JSON.stringify(cleanValues.metadata)
    );
    setPermissionSet(cleanValues.permissionSet);
    setRoleStatus(cleanValues.roleStatus);
    setRoleArn(cleanValues.roleArn);
    setExternalId(cleanValues.externalId);
    setCloudFormationTemplate(cleanValues.cloudFormationTemplate);
    setInvitationToken(cleanValues.invitationToken);
    setInvitationSentAt(cleanValues.invitationSentAt);
    setInvitationExpiresAt(cleanValues.invitationExpiresAt);
    setApprovedAt(cleanValues.approvedAt);
    setRoleEstablishedAt(cleanValues.roleEstablishedAt);
    setLastRoleVerification(cleanValues.lastRoleVerification);
    setRoleVerificationError(cleanValues.roleVerificationError);
    setErrors({});
  };
  const [customersRecord, setCustomersRecord] =
    React.useState(customersModelProp);
  React.useEffect(() => {
    const queryData = async () => {
      const record = idProp
        ? (
            await API.graphql({
              query: getCustomers.replaceAll("__typename", ""),
              variables: { id: idProp },
            })
          )?.data?.getCustomers
        : customersModelProp;
      setCustomersRecord(record);
    };
    queryData();
  }, [idProp, customersModelProp]);
  React.useEffect(resetStateValues, [customersRecord]);
  const [currentAccountIdsValue, setCurrentAccountIdsValue] =
    React.useState("");
  const accountIdsRef = React.createRef();
  const [currentApproverGroupIdsValue, setCurrentApproverGroupIdsValue] =
    React.useState("");
  const approverGroupIdsRef = React.createRef();
  const validations = {
    name: [{ type: "Required" }],
    description: [],
    accountIds: [],
    approverGroupIds: [],
    adminEmail: [],
    adminName: [],
    status: [],
    settings: [{ type: "JSON" }],
    createdAt: [],
    modifiedBy: [],
    metadata: [{ type: "JSON" }],
    permissionSet: [],
    roleStatus: [],
    roleArn: [],
    externalId: [],
    cloudFormationTemplate: [],
    invitationToken: [],
    invitationSentAt: [],
    invitationExpiresAt: [],
    approvedAt: [],
    roleEstablishedAt: [],
    lastRoleVerification: [],
    roleVerificationError: [],
  };
  const runValidationTasks = async (
    fieldName,
    currentValue,
    getDisplayValue
  ) => {
    const value =
      currentValue && getDisplayValue
        ? getDisplayValue(currentValue)
        : currentValue;
    let validationResponse = validateField(value, validations[fieldName]);
    const customValidator = fetchByPath(onValidate, fieldName);
    if (customValidator) {
      validationResponse = await customValidator(value, validationResponse);
    }
    setErrors((errors) => ({ ...errors, [fieldName]: validationResponse }));
    return validationResponse;
  };
  const convertToLocal = (date) => {
    const df = new Intl.DateTimeFormat("default", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      calendar: "iso8601",
      numberingSystem: "latn",
      hourCycle: "h23",
    });
    const parts = df.formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  return (
    <Grid
      as="form"
      rowGap="15px"
      columnGap="15px"
      padding="20px"
      onSubmit={async (event) => {
        event.preventDefault();
        let modelFields = {
          name,
          description: description ?? null,
          accountIds: accountIds ?? null,
          approverGroupIds: approverGroupIds ?? null,
          adminEmail: adminEmail ?? null,
          adminName: adminName ?? null,
          status: status ?? null,
          settings: settings ?? null,
          createdAt: createdAt ?? null,
          modifiedBy: modifiedBy ?? null,
          metadata: metadata ?? null,
          permissionSet: permissionSet ?? null,
          roleStatus: roleStatus ?? null,
          roleArn: roleArn ?? null,
          externalId: externalId ?? null,
          cloudFormationTemplate: cloudFormationTemplate ?? null,
          invitationToken: invitationToken ?? null,
          invitationSentAt: invitationSentAt ?? null,
          invitationExpiresAt: invitationExpiresAt ?? null,
          approvedAt: approvedAt ?? null,
          roleEstablishedAt: roleEstablishedAt ?? null,
          lastRoleVerification: lastRoleVerification ?? null,
          roleVerificationError: roleVerificationError ?? null,
        };
        const validationResponses = await Promise.all(
          Object.keys(validations).reduce((promises, fieldName) => {
            if (Array.isArray(modelFields[fieldName])) {
              promises.push(
                ...modelFields[fieldName].map((item) =>
                  runValidationTasks(fieldName, item)
                )
              );
              return promises;
            }
            promises.push(
              runValidationTasks(fieldName, modelFields[fieldName])
            );
            return promises;
          }, [])
        );
        if (validationResponses.some((r) => r.hasError)) {
          return;
        }
        if (onSubmit) {
          modelFields = onSubmit(modelFields);
        }
        try {
          Object.entries(modelFields).forEach(([key, value]) => {
            if (typeof value === "string" && value === "") {
              modelFields[key] = null;
            }
          });
          await API.graphql({
            query: updateCustomers.replaceAll("__typename", ""),
            variables: {
              input: {
                id: customersRecord.id,
                ...modelFields,
              },
            },
          });
          if (onSuccess) {
            onSuccess(modelFields);
          }
        } catch (err) {
          if (onError) {
            const messages = err.errors.map((e) => e.message).join("\n");
            onError(modelFields, messages);
          }
        }
      }}
      {...getOverrideProps(overrides, "CustomersUpdateForm")}
      {...rest}
    >
      <TextField
        label="Name"
        isRequired={true}
        isReadOnly={false}
        value={name}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name: value,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.name ?? value;
          }
          if (errors.name?.hasError) {
            runValidationTasks("name", value);
          }
          setName(value);
        }}
        onBlur={() => runValidationTasks("name", name)}
        errorMessage={errors.name?.errorMessage}
        hasError={errors.name?.hasError}
        {...getOverrideProps(overrides, "name")}
      ></TextField>
      <TextField
        label="Description"
        isRequired={false}
        isReadOnly={false}
        value={description}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description: value,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.description ?? value;
          }
          if (errors.description?.hasError) {
            runValidationTasks("description", value);
          }
          setDescription(value);
        }}
        onBlur={() => runValidationTasks("description", description)}
        errorMessage={errors.description?.errorMessage}
        hasError={errors.description?.hasError}
        {...getOverrideProps(overrides, "description")}
      ></TextField>
      <ArrayField
        onChange={async (items) => {
          let values = items;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds: values,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            values = result?.accountIds ?? values;
          }
          setAccountIds(values);
          setCurrentAccountIdsValue("");
        }}
        currentFieldValue={currentAccountIdsValue}
        label={"Account ids"}
        items={accountIds}
        hasError={errors?.accountIds?.hasError}
        runValidationTasks={async () =>
          await runValidationTasks("accountIds", currentAccountIdsValue)
        }
        errorMessage={errors?.accountIds?.errorMessage}
        setFieldValue={setCurrentAccountIdsValue}
        inputFieldRef={accountIdsRef}
        defaultFieldValue={""}
      >
        <TextField
          label="Account ids"
          isRequired={false}
          isReadOnly={false}
          value={currentAccountIdsValue}
          onChange={(e) => {
            let { value } = e.target;
            if (errors.accountIds?.hasError) {
              runValidationTasks("accountIds", value);
            }
            setCurrentAccountIdsValue(value);
          }}
          onBlur={() =>
            runValidationTasks("accountIds", currentAccountIdsValue)
          }
          errorMessage={errors.accountIds?.errorMessage}
          hasError={errors.accountIds?.hasError}
          ref={accountIdsRef}
          labelHidden={true}
          {...getOverrideProps(overrides, "accountIds")}
        ></TextField>
      </ArrayField>
      <ArrayField
        onChange={async (items) => {
          let values = items;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds: values,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            values = result?.approverGroupIds ?? values;
          }
          setApproverGroupIds(values);
          setCurrentApproverGroupIdsValue("");
        }}
        currentFieldValue={currentApproverGroupIdsValue}
        label={"Approver group ids"}
        items={approverGroupIds}
        hasError={errors?.approverGroupIds?.hasError}
        runValidationTasks={async () =>
          await runValidationTasks(
            "approverGroupIds",
            currentApproverGroupIdsValue
          )
        }
        errorMessage={errors?.approverGroupIds?.errorMessage}
        setFieldValue={setCurrentApproverGroupIdsValue}
        inputFieldRef={approverGroupIdsRef}
        defaultFieldValue={""}
      >
        <TextField
          label="Approver group ids"
          isRequired={false}
          isReadOnly={false}
          value={currentApproverGroupIdsValue}
          onChange={(e) => {
            let { value } = e.target;
            if (errors.approverGroupIds?.hasError) {
              runValidationTasks("approverGroupIds", value);
            }
            setCurrentApproverGroupIdsValue(value);
          }}
          onBlur={() =>
            runValidationTasks("approverGroupIds", currentApproverGroupIdsValue)
          }
          errorMessage={errors.approverGroupIds?.errorMessage}
          hasError={errors.approverGroupIds?.hasError}
          ref={approverGroupIdsRef}
          labelHidden={true}
          {...getOverrideProps(overrides, "approverGroupIds")}
        ></TextField>
      </ArrayField>
      <TextField
        label="Admin email"
        isRequired={false}
        isReadOnly={false}
        value={adminEmail}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail: value,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.adminEmail ?? value;
          }
          if (errors.adminEmail?.hasError) {
            runValidationTasks("adminEmail", value);
          }
          setAdminEmail(value);
        }}
        onBlur={() => runValidationTasks("adminEmail", adminEmail)}
        errorMessage={errors.adminEmail?.errorMessage}
        hasError={errors.adminEmail?.hasError}
        {...getOverrideProps(overrides, "adminEmail")}
      ></TextField>
      <TextField
        label="Admin name"
        isRequired={false}
        isReadOnly={false}
        value={adminName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName: value,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.adminName ?? value;
          }
          if (errors.adminName?.hasError) {
            runValidationTasks("adminName", value);
          }
          setAdminName(value);
        }}
        onBlur={() => runValidationTasks("adminName", adminName)}
        errorMessage={errors.adminName?.errorMessage}
        hasError={errors.adminName?.hasError}
        {...getOverrideProps(overrides, "adminName")}
      ></TextField>
      <TextField
        label="Status"
        isRequired={false}
        isReadOnly={false}
        value={status}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status: value,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.status ?? value;
          }
          if (errors.status?.hasError) {
            runValidationTasks("status", value);
          }
          setStatus(value);
        }}
        onBlur={() => runValidationTasks("status", status)}
        errorMessage={errors.status?.errorMessage}
        hasError={errors.status?.hasError}
        {...getOverrideProps(overrides, "status")}
      ></TextField>
      <TextAreaField
        label="Settings"
        isRequired={false}
        isReadOnly={false}
        value={settings}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings: value,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.settings ?? value;
          }
          if (errors.settings?.hasError) {
            runValidationTasks("settings", value);
          }
          setSettings(value);
        }}
        onBlur={() => runValidationTasks("settings", settings)}
        errorMessage={errors.settings?.errorMessage}
        hasError={errors.settings?.hasError}
        {...getOverrideProps(overrides, "settings")}
      ></TextAreaField>
      <TextField
        label="Created at"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={createdAt && convertToLocal(new Date(createdAt))}
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt: value,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.createdAt ?? value;
          }
          if (errors.createdAt?.hasError) {
            runValidationTasks("createdAt", value);
          }
          setCreatedAt(value);
        }}
        onBlur={() => runValidationTasks("createdAt", createdAt)}
        errorMessage={errors.createdAt?.errorMessage}
        hasError={errors.createdAt?.hasError}
        {...getOverrideProps(overrides, "createdAt")}
      ></TextField>
      <TextField
        label="Modified by"
        isRequired={false}
        isReadOnly={false}
        value={modifiedBy}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy: value,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.modifiedBy ?? value;
          }
          if (errors.modifiedBy?.hasError) {
            runValidationTasks("modifiedBy", value);
          }
          setModifiedBy(value);
        }}
        onBlur={() => runValidationTasks("modifiedBy", modifiedBy)}
        errorMessage={errors.modifiedBy?.errorMessage}
        hasError={errors.modifiedBy?.hasError}
        {...getOverrideProps(overrides, "modifiedBy")}
      ></TextField>
      <TextAreaField
        label="Metadata"
        isRequired={false}
        isReadOnly={false}
        value={metadata}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata: value,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.metadata ?? value;
          }
          if (errors.metadata?.hasError) {
            runValidationTasks("metadata", value);
          }
          setMetadata(value);
        }}
        onBlur={() => runValidationTasks("metadata", metadata)}
        errorMessage={errors.metadata?.errorMessage}
        hasError={errors.metadata?.hasError}
        {...getOverrideProps(overrides, "metadata")}
      ></TextAreaField>
      <TextField
        label="Permission set"
        isRequired={false}
        isReadOnly={false}
        value={permissionSet}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet: value,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.permissionSet ?? value;
          }
          if (errors.permissionSet?.hasError) {
            runValidationTasks("permissionSet", value);
          }
          setPermissionSet(value);
        }}
        onBlur={() => runValidationTasks("permissionSet", permissionSet)}
        errorMessage={errors.permissionSet?.errorMessage}
        hasError={errors.permissionSet?.hasError}
        {...getOverrideProps(overrides, "permissionSet")}
      ></TextField>
      <TextField
        label="Role status"
        isRequired={false}
        isReadOnly={false}
        value={roleStatus}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus: value,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.roleStatus ?? value;
          }
          if (errors.roleStatus?.hasError) {
            runValidationTasks("roleStatus", value);
          }
          setRoleStatus(value);
        }}
        onBlur={() => runValidationTasks("roleStatus", roleStatus)}
        errorMessage={errors.roleStatus?.errorMessage}
        hasError={errors.roleStatus?.hasError}
        {...getOverrideProps(overrides, "roleStatus")}
      ></TextField>
      <TextField
        label="Role arn"
        isRequired={false}
        isReadOnly={false}
        value={roleArn}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn: value,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.roleArn ?? value;
          }
          if (errors.roleArn?.hasError) {
            runValidationTasks("roleArn", value);
          }
          setRoleArn(value);
        }}
        onBlur={() => runValidationTasks("roleArn", roleArn)}
        errorMessage={errors.roleArn?.errorMessage}
        hasError={errors.roleArn?.hasError}
        {...getOverrideProps(overrides, "roleArn")}
      ></TextField>
      <TextField
        label="External id"
        isRequired={false}
        isReadOnly={false}
        value={externalId}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId: value,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.externalId ?? value;
          }
          if (errors.externalId?.hasError) {
            runValidationTasks("externalId", value);
          }
          setExternalId(value);
        }}
        onBlur={() => runValidationTasks("externalId", externalId)}
        errorMessage={errors.externalId?.errorMessage}
        hasError={errors.externalId?.hasError}
        {...getOverrideProps(overrides, "externalId")}
      ></TextField>
      <TextField
        label="Cloud formation template"
        isRequired={false}
        isReadOnly={false}
        value={cloudFormationTemplate}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate: value,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.cloudFormationTemplate ?? value;
          }
          if (errors.cloudFormationTemplate?.hasError) {
            runValidationTasks("cloudFormationTemplate", value);
          }
          setCloudFormationTemplate(value);
        }}
        onBlur={() =>
          runValidationTasks("cloudFormationTemplate", cloudFormationTemplate)
        }
        errorMessage={errors.cloudFormationTemplate?.errorMessage}
        hasError={errors.cloudFormationTemplate?.hasError}
        {...getOverrideProps(overrides, "cloudFormationTemplate")}
      ></TextField>
      <TextField
        label="Invitation token"
        isRequired={false}
        isReadOnly={false}
        value={invitationToken}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken: value,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.invitationToken ?? value;
          }
          if (errors.invitationToken?.hasError) {
            runValidationTasks("invitationToken", value);
          }
          setInvitationToken(value);
        }}
        onBlur={() => runValidationTasks("invitationToken", invitationToken)}
        errorMessage={errors.invitationToken?.errorMessage}
        hasError={errors.invitationToken?.hasError}
        {...getOverrideProps(overrides, "invitationToken")}
      ></TextField>
      <TextField
        label="Invitation sent at"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={invitationSentAt && convertToLocal(new Date(invitationSentAt))}
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt: value,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.invitationSentAt ?? value;
          }
          if (errors.invitationSentAt?.hasError) {
            runValidationTasks("invitationSentAt", value);
          }
          setInvitationSentAt(value);
        }}
        onBlur={() => runValidationTasks("invitationSentAt", invitationSentAt)}
        errorMessage={errors.invitationSentAt?.errorMessage}
        hasError={errors.invitationSentAt?.hasError}
        {...getOverrideProps(overrides, "invitationSentAt")}
      ></TextField>
      <TextField
        label="Invitation expires at"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={
          invitationExpiresAt && convertToLocal(new Date(invitationExpiresAt))
        }
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt: value,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.invitationExpiresAt ?? value;
          }
          if (errors.invitationExpiresAt?.hasError) {
            runValidationTasks("invitationExpiresAt", value);
          }
          setInvitationExpiresAt(value);
        }}
        onBlur={() =>
          runValidationTasks("invitationExpiresAt", invitationExpiresAt)
        }
        errorMessage={errors.invitationExpiresAt?.errorMessage}
        hasError={errors.invitationExpiresAt?.hasError}
        {...getOverrideProps(overrides, "invitationExpiresAt")}
      ></TextField>
      <TextField
        label="Approved at"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={approvedAt && convertToLocal(new Date(approvedAt))}
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt: value,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.approvedAt ?? value;
          }
          if (errors.approvedAt?.hasError) {
            runValidationTasks("approvedAt", value);
          }
          setApprovedAt(value);
        }}
        onBlur={() => runValidationTasks("approvedAt", approvedAt)}
        errorMessage={errors.approvedAt?.errorMessage}
        hasError={errors.approvedAt?.hasError}
        {...getOverrideProps(overrides, "approvedAt")}
      ></TextField>
      <TextField
        label="Role established at"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={roleEstablishedAt && convertToLocal(new Date(roleEstablishedAt))}
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt: value,
              lastRoleVerification,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.roleEstablishedAt ?? value;
          }
          if (errors.roleEstablishedAt?.hasError) {
            runValidationTasks("roleEstablishedAt", value);
          }
          setRoleEstablishedAt(value);
        }}
        onBlur={() =>
          runValidationTasks("roleEstablishedAt", roleEstablishedAt)
        }
        errorMessage={errors.roleEstablishedAt?.errorMessage}
        hasError={errors.roleEstablishedAt?.hasError}
        {...getOverrideProps(overrides, "roleEstablishedAt")}
      ></TextField>
      <TextField
        label="Last role verification"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={
          lastRoleVerification && convertToLocal(new Date(lastRoleVerification))
        }
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification: value,
              roleVerificationError,
            };
            const result = onChange(modelFields);
            value = result?.lastRoleVerification ?? value;
          }
          if (errors.lastRoleVerification?.hasError) {
            runValidationTasks("lastRoleVerification", value);
          }
          setLastRoleVerification(value);
        }}
        onBlur={() =>
          runValidationTasks("lastRoleVerification", lastRoleVerification)
        }
        errorMessage={errors.lastRoleVerification?.errorMessage}
        hasError={errors.lastRoleVerification?.hasError}
        {...getOverrideProps(overrides, "lastRoleVerification")}
      ></TextField>
      <TextField
        label="Role verification error"
        isRequired={false}
        isReadOnly={false}
        value={roleVerificationError}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              description,
              accountIds,
              approverGroupIds,
              adminEmail,
              adminName,
              status,
              settings,
              createdAt,
              modifiedBy,
              metadata,
              permissionSet,
              roleStatus,
              roleArn,
              externalId,
              cloudFormationTemplate,
              invitationToken,
              invitationSentAt,
              invitationExpiresAt,
              approvedAt,
              roleEstablishedAt,
              lastRoleVerification,
              roleVerificationError: value,
            };
            const result = onChange(modelFields);
            value = result?.roleVerificationError ?? value;
          }
          if (errors.roleVerificationError?.hasError) {
            runValidationTasks("roleVerificationError", value);
          }
          setRoleVerificationError(value);
        }}
        onBlur={() =>
          runValidationTasks("roleVerificationError", roleVerificationError)
        }
        errorMessage={errors.roleVerificationError?.errorMessage}
        hasError={errors.roleVerificationError?.hasError}
        {...getOverrideProps(overrides, "roleVerificationError")}
      ></TextField>
      <Flex
        justifyContent="space-between"
        {...getOverrideProps(overrides, "CTAFlex")}
      >
        <Button
          children="Reset"
          type="reset"
          onClick={(event) => {
            event.preventDefault();
            resetStateValues();
          }}
          isDisabled={!(idProp || customersModelProp)}
          {...getOverrideProps(overrides, "ResetButton")}
        ></Button>
        <Flex
          gap="15px"
          {...getOverrideProps(overrides, "RightAlignCTASubFlex")}
        >
          <Button
            children="Submit"
            type="submit"
            variation="primary"
            isDisabled={
              !(idProp || customersModelProp) ||
              Object.values(errors).some((e) => e?.hasError)
            }
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
