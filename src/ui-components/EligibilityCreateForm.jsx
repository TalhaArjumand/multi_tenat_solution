/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

/* eslint-disable */
import * as React from "react";
import {
  Button,
  Flex,
  Grid,
  SwitchField,
  TextField,
} from "@aws-amplify/ui-react";
import { fetchByPath, getOverrideProps, validateField } from "./utils";
import { API } from "aws-amplify";
import { createEligibility } from "../graphql/mutations";
export default function EligibilityCreateForm(props) {
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
    ticketNo: "",
    approvalRequired: false,
    duration: "",
    modifiedBy: "",
    customerId: "",
    customerName: "",
  };
  const [name, setName] = React.useState(initialValues.name);
  const [type, setType] = React.useState(initialValues.type);
  const [ticketNo, setTicketNo] = React.useState(initialValues.ticketNo);
  const [approvalRequired, setApprovalRequired] = React.useState(
    initialValues.approvalRequired
  );
  const [duration, setDuration] = React.useState(initialValues.duration);
  const [modifiedBy, setModifiedBy] = React.useState(initialValues.modifiedBy);
  const [customerId, setCustomerId] = React.useState(initialValues.customerId);
  const [customerName, setCustomerName] = React.useState(
    initialValues.customerName
  );
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    setName(initialValues.name);
    setType(initialValues.type);
    setTicketNo(initialValues.ticketNo);
    setApprovalRequired(initialValues.approvalRequired);
    setDuration(initialValues.duration);
    setModifiedBy(initialValues.modifiedBy);
    setCustomerId(initialValues.customerId);
    setCustomerName(initialValues.customerName);
    setErrors({});
  };
  const validations = {
    name: [],
    type: [],
    ticketNo: [],
    approvalRequired: [],
    duration: [],
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
          ticketNo,
          approvalRequired,
          duration,
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
            query: createEligibility.replaceAll("__typename", ""),
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
      {...getOverrideProps(overrides, "EligibilityCreateForm")}
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
              ticketNo,
              approvalRequired,
              duration,
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
              ticketNo,
              approvalRequired,
              duration,
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
              ticketNo: value,
              approvalRequired,
              duration,
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
      <SwitchField
        label="Approval required"
        defaultChecked={false}
        isDisabled={false}
        isChecked={approvalRequired}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              name,
              type,
              ticketNo,
              approvalRequired: value,
              duration,
              modifiedBy,
              customerId,
              customerName,
            };
            const result = onChange(modelFields);
            value = result?.approvalRequired ?? value;
          }
          if (errors.approvalRequired?.hasError) {
            runValidationTasks("approvalRequired", value);
          }
          setApprovalRequired(value);
        }}
        onBlur={() => runValidationTasks("approvalRequired", approvalRequired)}
        errorMessage={errors.approvalRequired?.errorMessage}
        hasError={errors.approvalRequired?.hasError}
        {...getOverrideProps(overrides, "approvalRequired")}
      ></SwitchField>
      <TextField
        label="Duration"
        isRequired={false}
        isReadOnly={false}
        value={duration}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              name,
              type,
              ticketNo,
              approvalRequired,
              duration: value,
              modifiedBy,
              customerId,
              customerName,
            };
            const result = onChange(modelFields);
            value = result?.duration ?? value;
          }
          if (errors.duration?.hasError) {
            runValidationTasks("duration", value);
          }
          setDuration(value);
        }}
        onBlur={() => runValidationTasks("duration", duration)}
        errorMessage={errors.duration?.errorMessage}
        hasError={errors.duration?.hasError}
        {...getOverrideProps(overrides, "duration")}
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
              ticketNo,
              approvalRequired,
              duration,
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
              ticketNo,
              approvalRequired,
              duration,
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
              ticketNo,
              approvalRequired,
              duration,
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
