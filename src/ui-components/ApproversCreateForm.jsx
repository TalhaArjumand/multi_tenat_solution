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
  TextField,
  useTheme,
} from "@aws-amplify/ui-react";
import { fetchByPath, getOverrideProps, validateField } from "./utils";
import { API } from "aws-amplify";
import { createApprovers } from "../graphql/mutations";
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
export default function ApproversCreateForm(props) {
  const {
    clearOnSuccess = true,
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
    type: "",
    approvers: [],
    groupIds: [],
    ticketNo: "",
    modifiedBy: "",
    customerId: "",
    customerName: "",
  };
  const [name, setName] = React.useState(initialValues.name);
  const [type, setType] = React.useState(initialValues.type);
  const [approvers, setApprovers] = React.useState(initialValues.approvers);
  const [groupIds, setGroupIds] = React.useState(initialValues.groupIds);
  const [ticketNo, setTicketNo] = React.useState(initialValues.ticketNo);
  const [modifiedBy, setModifiedBy] = React.useState(initialValues.modifiedBy);
  const [customerId, setCustomerId] = React.useState(initialValues.customerId);
  const [customerName, setCustomerName] = React.useState(
    initialValues.customerName
  );
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    setName(initialValues.name);
    setType(initialValues.type);
    setApprovers(initialValues.approvers);
    setCurrentApproversValue("");
    setGroupIds(initialValues.groupIds);
    setCurrentGroupIdsValue("");
    setTicketNo(initialValues.ticketNo);
    setModifiedBy(initialValues.modifiedBy);
    setCustomerId(initialValues.customerId);
    setCustomerName(initialValues.customerName);
    setErrors({});
  };
  const [currentApproversValue, setCurrentApproversValue] = React.useState("");
  const approversRef = React.createRef();
  const [currentGroupIdsValue, setCurrentGroupIdsValue] = React.useState("");
  const groupIdsRef = React.createRef();
  const validations = {
    name: [],
    type: [],
    approvers: [],
    groupIds: [],
    ticketNo: [],
    modifiedBy: [],
    customerId: [],
    customerName: [],
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
          type,
          approvers,
          groupIds,
          ticketNo,
          modifiedBy,
          customerId,
          customerName,
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
            query: createApprovers.replaceAll("__typename", ""),
            variables: {
              input: {
                ...modelFields,
              },
            },
          });
          if (onSuccess) {
            onSuccess(modelFields);
          }
          if (clearOnSuccess) {
            resetStateValues();
          }
        } catch (err) {
          if (onError) {
            const messages = err.errors.map((e) => e.message).join("\n");
            onError(modelFields, messages);
          }
        }
      }}
      {...getOverrideProps(overrides, "ApproversCreateForm")}
      {...rest}
    >
      <TextField
        label="Name"
        isRequired={false}
        isReadOnly={false}
        value={name}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name: value,
              type,
              approvers,
              groupIds,
              ticketNo,
              modifiedBy,
              customerId,
              customerName,
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
        label="Type"
        isRequired={false}
        isReadOnly={false}
        value={type}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              type: value,
              approvers,
              groupIds,
              ticketNo,
              modifiedBy,
              customerId,
              customerName,
            };
            const result = onChange(modelFields);
            value = result?.type ?? value;
          }
          if (errors.type?.hasError) {
            runValidationTasks("type", value);
          }
          setType(value);
        }}
        onBlur={() => runValidationTasks("type", type)}
        errorMessage={errors.type?.errorMessage}
        hasError={errors.type?.hasError}
        {...getOverrideProps(overrides, "type")}
      ></TextField>
      <ArrayField
        onChange={async (items) => {
          let values = items;
          if (onChange) {
            const modelFields = {
              name,
              type,
              approvers: values,
              groupIds,
              ticketNo,
              modifiedBy,
              customerId,
              customerName,
            };
            const result = onChange(modelFields);
            values = result?.approvers ?? values;
          }
          setApprovers(values);
          setCurrentApproversValue("");
        }}
        currentFieldValue={currentApproversValue}
        label={"Approvers"}
        items={approvers}
        hasError={errors?.approvers?.hasError}
        runValidationTasks={async () =>
          await runValidationTasks("approvers", currentApproversValue)
        }
        errorMessage={errors?.approvers?.errorMessage}
        setFieldValue={setCurrentApproversValue}
        inputFieldRef={approversRef}
        defaultFieldValue={""}
      >
        <TextField
          label="Approvers"
          isRequired={false}
          isReadOnly={false}
          value={currentApproversValue}
          onChange={(e) => {
            let { value } = e.target;
            if (errors.approvers?.hasError) {
              runValidationTasks("approvers", value);
            }
            setCurrentApproversValue(value);
          }}
          onBlur={() => runValidationTasks("approvers", currentApproversValue)}
          errorMessage={errors.approvers?.errorMessage}
          hasError={errors.approvers?.hasError}
          ref={approversRef}
          labelHidden={true}
          {...getOverrideProps(overrides, "approvers")}
        ></TextField>
      </ArrayField>
      <ArrayField
        onChange={async (items) => {
          let values = items;
          if (onChange) {
            const modelFields = {
              name,
              type,
              approvers,
              groupIds: values,
              ticketNo,
              modifiedBy,
              customerId,
              customerName,
            };
            const result = onChange(modelFields);
            values = result?.groupIds ?? values;
          }
          setGroupIds(values);
          setCurrentGroupIdsValue("");
        }}
        currentFieldValue={currentGroupIdsValue}
        label={"Group ids"}
        items={groupIds}
        hasError={errors?.groupIds?.hasError}
        runValidationTasks={async () =>
          await runValidationTasks("groupIds", currentGroupIdsValue)
        }
        errorMessage={errors?.groupIds?.errorMessage}
        setFieldValue={setCurrentGroupIdsValue}
        inputFieldRef={groupIdsRef}
        defaultFieldValue={""}
      >
        <TextField
          label="Group ids"
          isRequired={false}
          isReadOnly={false}
          value={currentGroupIdsValue}
          onChange={(e) => {
            let { value } = e.target;
            if (errors.groupIds?.hasError) {
              runValidationTasks("groupIds", value);
            }
            setCurrentGroupIdsValue(value);
          }}
          onBlur={() => runValidationTasks("groupIds", currentGroupIdsValue)}
          errorMessage={errors.groupIds?.errorMessage}
          hasError={errors.groupIds?.hasError}
          ref={groupIdsRef}
          labelHidden={true}
          {...getOverrideProps(overrides, "groupIds")}
        ></TextField>
      </ArrayField>
      <TextField
        label="Ticket no"
        isRequired={false}
        isReadOnly={false}
        value={ticketNo}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              type,
              approvers,
              groupIds,
              ticketNo: value,
              modifiedBy,
              customerId,
              customerName,
            };
            const result = onChange(modelFields);
            value = result?.ticketNo ?? value;
          }
          if (errors.ticketNo?.hasError) {
            runValidationTasks("ticketNo", value);
          }
          setTicketNo(value);
        }}
        onBlur={() => runValidationTasks("ticketNo", ticketNo)}
        errorMessage={errors.ticketNo?.errorMessage}
        hasError={errors.ticketNo?.hasError}
        {...getOverrideProps(overrides, "ticketNo")}
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
              type,
              approvers,
              groupIds,
              ticketNo,
              modifiedBy: value,
              customerId,
              customerName,
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
      <TextField
        label="Customer id"
        isRequired={false}
        isReadOnly={false}
        value={customerId}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              type,
              approvers,
              groupIds,
              ticketNo,
              modifiedBy,
              customerId: value,
              customerName,
            };
            const result = onChange(modelFields);
            value = result?.customerId ?? value;
          }
          if (errors.customerId?.hasError) {
            runValidationTasks("customerId", value);
          }
          setCustomerId(value);
        }}
        onBlur={() => runValidationTasks("customerId", customerId)}
        errorMessage={errors.customerId?.errorMessage}
        hasError={errors.customerId?.hasError}
        {...getOverrideProps(overrides, "customerId")}
      ></TextField>
      <TextField
        label="Customer name"
        isRequired={false}
        isReadOnly={false}
        value={customerName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              type,
              approvers,
              groupIds,
              ticketNo,
              modifiedBy,
              customerId,
              customerName: value,
            };
            const result = onChange(modelFields);
            value = result?.customerName ?? value;
          }
          if (errors.customerName?.hasError) {
            runValidationTasks("customerName", value);
          }
          setCustomerName(value);
        }}
        onBlur={() => runValidationTasks("customerName", customerName)}
        errorMessage={errors.customerName?.errorMessage}
        hasError={errors.customerName?.hasError}
        {...getOverrideProps(overrides, "customerName")}
      ></TextField>
      <Flex
        justifyContent="space-between"
        {...getOverrideProps(overrides, "CTAFlex")}
      >
        <Button
          children="Clear"
          type="reset"
          onClick={(event) => {
            event.preventDefault();
            resetStateValues();
          }}
          {...getOverrideProps(overrides, "ClearButton")}
        ></Button>
        <Flex
          gap="15px"
          {...getOverrideProps(overrides, "RightAlignCTASubFlex")}
        >
          <Button
            children="Submit"
            type="submit"
            variation="primary"
            isDisabled={Object.values(errors).some((e) => e?.hasError)}
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
