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
import { getSettings } from "../graphql/queries";
import { updateSettings } from "../graphql/mutations";
export default function SettingsUpdateForm(props) {
  const {
    id: idProp,
    settings: settingsModelProp,
    onSuccess,
    onError,
    onSubmit,
    onValidate,
    onChange,
    overrides,
    ...rest
  } = props;
  const initialValues = {
    id: "",
    duration: "",
    expiry: "",
    comments: false,
    ticketNo: false,
    approval: false,
    modifiedBy: "",
    sesNotificationsEnabled: false,
    snsNotificationsEnabled: false,
    slackNotificationsEnabled: false,
    slackAuditNotificationsChannel: "",
    sesSourceEmail: "",
    sesSourceArn: "",
    slackToken: "",
    teamAdminGroup: "",
    teamAuditorGroup: "",
    teamCustomerAdminGroup: "",
    activationMode: "",
  };
  const [id, setId] = React.useState(initialValues.id);
  const [duration, setDuration] = React.useState(initialValues.duration);
  const [expiry, setExpiry] = React.useState(initialValues.expiry);
  const [comments, setComments] = React.useState(initialValues.comments);
  const [ticketNo, setTicketNo] = React.useState(initialValues.ticketNo);
  const [approval, setApproval] = React.useState(initialValues.approval);
  const [modifiedBy, setModifiedBy] = React.useState(initialValues.modifiedBy);
  const [sesNotificationsEnabled, setSesNotificationsEnabled] = React.useState(
    initialValues.sesNotificationsEnabled
  );
  const [snsNotificationsEnabled, setSnsNotificationsEnabled] = React.useState(
    initialValues.snsNotificationsEnabled
  );
  const [slackNotificationsEnabled, setSlackNotificationsEnabled] =
    React.useState(initialValues.slackNotificationsEnabled);
  const [slackAuditNotificationsChannel, setSlackAuditNotificationsChannel] =
    React.useState(initialValues.slackAuditNotificationsChannel);
  const [sesSourceEmail, setSesSourceEmail] = React.useState(
    initialValues.sesSourceEmail
  );
  const [sesSourceArn, setSesSourceArn] = React.useState(
    initialValues.sesSourceArn
  );
  const [slackToken, setSlackToken] = React.useState(initialValues.slackToken);
  const [teamAdminGroup, setTeamAdminGroup] = React.useState(
    initialValues.teamAdminGroup
  );
  const [teamAuditorGroup, setTeamAuditorGroup] = React.useState(
    initialValues.teamAuditorGroup
  );
  const [teamCustomerAdminGroup, setTeamCustomerAdminGroup] = React.useState(
    initialValues.teamCustomerAdminGroup
  );
  const [activationMode, setActivationMode] = React.useState(
    initialValues.activationMode
  );
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    const cleanValues = settingsRecord
      ? { ...initialValues, ...settingsRecord }
      : initialValues;
    setId(cleanValues.id);
    setDuration(cleanValues.duration);
    setExpiry(cleanValues.expiry);
    setComments(cleanValues.comments);
    setTicketNo(cleanValues.ticketNo);
    setApproval(cleanValues.approval);
    setModifiedBy(cleanValues.modifiedBy);
    setSesNotificationsEnabled(cleanValues.sesNotificationsEnabled);
    setSnsNotificationsEnabled(cleanValues.snsNotificationsEnabled);
    setSlackNotificationsEnabled(cleanValues.slackNotificationsEnabled);
    setSlackAuditNotificationsChannel(
      cleanValues.slackAuditNotificationsChannel
    );
    setSesSourceEmail(cleanValues.sesSourceEmail);
    setSesSourceArn(cleanValues.sesSourceArn);
    setSlackToken(cleanValues.slackToken);
    setTeamAdminGroup(cleanValues.teamAdminGroup);
    setTeamAuditorGroup(cleanValues.teamAuditorGroup);
    setTeamCustomerAdminGroup(cleanValues.teamCustomerAdminGroup);
    setActivationMode(cleanValues.activationMode);
    setErrors({});
  };
  const [settingsRecord, setSettingsRecord] = React.useState(settingsModelProp);
  React.useEffect(() => {
    const queryData = async () => {
      const record = idProp
        ? (
            await API.graphql({
              query: getSettings.replaceAll("__typename", ""),
              variables: { id: idProp },
            })
          )?.data?.getSettings
        : settingsModelProp;
      setSettingsRecord(record);
    };
    queryData();
  }, [idProp, settingsModelProp]);
  React.useEffect(resetStateValues, [settingsRecord]);
  const validations = {
    id: [{ type: "Required" }],
    duration: [],
    expiry: [],
    comments: [],
    ticketNo: [],
    approval: [],
    modifiedBy: [],
    sesNotificationsEnabled: [],
    snsNotificationsEnabled: [],
    slackNotificationsEnabled: [],
    slackAuditNotificationsChannel: [],
    sesSourceEmail: [],
    sesSourceArn: [],
    slackToken: [],
    teamAdminGroup: [],
    teamAuditorGroup: [],
    teamCustomerAdminGroup: [],
    activationMode: [],
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
          id,
          duration: duration ?? null,
          expiry: expiry ?? null,
          comments: comments ?? null,
          ticketNo: ticketNo ?? null,
          approval: approval ?? null,
          modifiedBy: modifiedBy ?? null,
          sesNotificationsEnabled: sesNotificationsEnabled ?? null,
          snsNotificationsEnabled: snsNotificationsEnabled ?? null,
          slackNotificationsEnabled: slackNotificationsEnabled ?? null,
          slackAuditNotificationsChannel:
            slackAuditNotificationsChannel ?? null,
          sesSourceEmail: sesSourceEmail ?? null,
          sesSourceArn: sesSourceArn ?? null,
          slackToken: slackToken ?? null,
          teamAdminGroup: teamAdminGroup ?? null,
          teamAuditorGroup: teamAuditorGroup ?? null,
          teamCustomerAdminGroup: teamCustomerAdminGroup ?? null,
          activationMode: activationMode ?? null,
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
            query: updateSettings.replaceAll("__typename", ""),
            variables: {
              input: {
                id: settingsRecord.id,
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
      {...getOverrideProps(overrides, "SettingsUpdateForm")}
      {...rest}
    >
      <TextField
        label="Id"
        isRequired={true}
        isReadOnly={true}
        value={id}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id: value,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.id ?? value;
          }
          if (errors.id?.hasError) {
            runValidationTasks("id", value);
          }
          setId(value);
        }}
        onBlur={() => runValidationTasks("id", id)}
        errorMessage={errors.id?.errorMessage}
        hasError={errors.id?.hasError}
        {...getOverrideProps(overrides, "id")}
      ></TextField>
      <TextField
        label="Duration"
        isRequired={false}
        isReadOnly={false}
        value={duration}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration: value,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
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
        label="Expiry"
        isRequired={false}
        isReadOnly={false}
        value={expiry}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry: value,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.expiry ?? value;
          }
          if (errors.expiry?.hasError) {
            runValidationTasks("expiry", value);
          }
          setExpiry(value);
        }}
        onBlur={() => runValidationTasks("expiry", expiry)}
        errorMessage={errors.expiry?.errorMessage}
        hasError={errors.expiry?.hasError}
        {...getOverrideProps(overrides, "expiry")}
      ></TextField>
      <SwitchField
        label="Comments"
        defaultChecked={false}
        isDisabled={false}
        isChecked={comments}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments: value,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.comments ?? value;
          }
          if (errors.comments?.hasError) {
            runValidationTasks("comments", value);
          }
          setComments(value);
        }}
        onBlur={() => runValidationTasks("comments", comments)}
        errorMessage={errors.comments?.errorMessage}
        hasError={errors.comments?.hasError}
        {...getOverrideProps(overrides, "comments")}
      ></SwitchField>
      <SwitchField
        label="Ticket no"
        defaultChecked={false}
        isDisabled={false}
        isChecked={ticketNo}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo: value,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
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
      ></SwitchField>
      <SwitchField
        label="Approval"
        defaultChecked={false}
        isDisabled={false}
        isChecked={approval}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval: value,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.approval ?? value;
          }
          if (errors.approval?.hasError) {
            runValidationTasks("approval", value);
          }
          setApproval(value);
        }}
        onBlur={() => runValidationTasks("approval", approval)}
        errorMessage={errors.approval?.errorMessage}
        hasError={errors.approval?.hasError}
        {...getOverrideProps(overrides, "approval")}
      ></SwitchField>
      <TextField
        label="Modified by"
        isRequired={false}
        isReadOnly={false}
        value={modifiedBy}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy: value,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
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
      <SwitchField
        label="Ses notifications enabled"
        defaultChecked={false}
        isDisabled={false}
        isChecked={sesNotificationsEnabled}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled: value,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.sesNotificationsEnabled ?? value;
          }
          if (errors.sesNotificationsEnabled?.hasError) {
            runValidationTasks("sesNotificationsEnabled", value);
          }
          setSesNotificationsEnabled(value);
        }}
        onBlur={() =>
          runValidationTasks("sesNotificationsEnabled", sesNotificationsEnabled)
        }
        errorMessage={errors.sesNotificationsEnabled?.errorMessage}
        hasError={errors.sesNotificationsEnabled?.hasError}
        {...getOverrideProps(overrides, "sesNotificationsEnabled")}
      ></SwitchField>
      <SwitchField
        label="Sns notifications enabled"
        defaultChecked={false}
        isDisabled={false}
        isChecked={snsNotificationsEnabled}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled: value,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.snsNotificationsEnabled ?? value;
          }
          if (errors.snsNotificationsEnabled?.hasError) {
            runValidationTasks("snsNotificationsEnabled", value);
          }
          setSnsNotificationsEnabled(value);
        }}
        onBlur={() =>
          runValidationTasks("snsNotificationsEnabled", snsNotificationsEnabled)
        }
        errorMessage={errors.snsNotificationsEnabled?.errorMessage}
        hasError={errors.snsNotificationsEnabled?.hasError}
        {...getOverrideProps(overrides, "snsNotificationsEnabled")}
      ></SwitchField>
      <SwitchField
        label="Slack notifications enabled"
        defaultChecked={false}
        isDisabled={false}
        isChecked={slackNotificationsEnabled}
        onChange={(e) => {
          let value = e.target.checked;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled: value,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.slackNotificationsEnabled ?? value;
          }
          if (errors.slackNotificationsEnabled?.hasError) {
            runValidationTasks("slackNotificationsEnabled", value);
          }
          setSlackNotificationsEnabled(value);
        }}
        onBlur={() =>
          runValidationTasks(
            "slackNotificationsEnabled",
            slackNotificationsEnabled
          )
        }
        errorMessage={errors.slackNotificationsEnabled?.errorMessage}
        hasError={errors.slackNotificationsEnabled?.hasError}
        {...getOverrideProps(overrides, "slackNotificationsEnabled")}
      ></SwitchField>
      <TextField
        label="Slack audit notifications channel"
        isRequired={false}
        isReadOnly={false}
        value={slackAuditNotificationsChannel}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel: value,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.slackAuditNotificationsChannel ?? value;
          }
          if (errors.slackAuditNotificationsChannel?.hasError) {
            runValidationTasks("slackAuditNotificationsChannel", value);
          }
          setSlackAuditNotificationsChannel(value);
        }}
        onBlur={() =>
          runValidationTasks(
            "slackAuditNotificationsChannel",
            slackAuditNotificationsChannel
          )
        }
        errorMessage={errors.slackAuditNotificationsChannel?.errorMessage}
        hasError={errors.slackAuditNotificationsChannel?.hasError}
        {...getOverrideProps(overrides, "slackAuditNotificationsChannel")}
      ></TextField>
      <TextField
        label="Ses source email"
        isRequired={false}
        isReadOnly={false}
        value={sesSourceEmail}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail: value,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.sesSourceEmail ?? value;
          }
          if (errors.sesSourceEmail?.hasError) {
            runValidationTasks("sesSourceEmail", value);
          }
          setSesSourceEmail(value);
        }}
        onBlur={() => runValidationTasks("sesSourceEmail", sesSourceEmail)}
        errorMessage={errors.sesSourceEmail?.errorMessage}
        hasError={errors.sesSourceEmail?.hasError}
        {...getOverrideProps(overrides, "sesSourceEmail")}
      ></TextField>
      <TextField
        label="Ses source arn"
        isRequired={false}
        isReadOnly={false}
        value={sesSourceArn}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn: value,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.sesSourceArn ?? value;
          }
          if (errors.sesSourceArn?.hasError) {
            runValidationTasks("sesSourceArn", value);
          }
          setSesSourceArn(value);
        }}
        onBlur={() => runValidationTasks("sesSourceArn", sesSourceArn)}
        errorMessage={errors.sesSourceArn?.errorMessage}
        hasError={errors.sesSourceArn?.hasError}
        {...getOverrideProps(overrides, "sesSourceArn")}
      ></TextField>
      <TextField
        label="Slack token"
        isRequired={false}
        isReadOnly={false}
        value={slackToken}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken: value,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.slackToken ?? value;
          }
          if (errors.slackToken?.hasError) {
            runValidationTasks("slackToken", value);
          }
          setSlackToken(value);
        }}
        onBlur={() => runValidationTasks("slackToken", slackToken)}
        errorMessage={errors.slackToken?.errorMessage}
        hasError={errors.slackToken?.hasError}
        {...getOverrideProps(overrides, "slackToken")}
      ></TextField>
      <TextField
        label="Team admin group"
        isRequired={false}
        isReadOnly={false}
        value={teamAdminGroup}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup: value,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.teamAdminGroup ?? value;
          }
          if (errors.teamAdminGroup?.hasError) {
            runValidationTasks("teamAdminGroup", value);
          }
          setTeamAdminGroup(value);
        }}
        onBlur={() => runValidationTasks("teamAdminGroup", teamAdminGroup)}
        errorMessage={errors.teamAdminGroup?.errorMessage}
        hasError={errors.teamAdminGroup?.hasError}
        {...getOverrideProps(overrides, "teamAdminGroup")}
      ></TextField>
      <TextField
        label="Team auditor group"
        isRequired={false}
        isReadOnly={false}
        value={teamAuditorGroup}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup: value,
              teamCustomerAdminGroup,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.teamAuditorGroup ?? value;
          }
          if (errors.teamAuditorGroup?.hasError) {
            runValidationTasks("teamAuditorGroup", value);
          }
          setTeamAuditorGroup(value);
        }}
        onBlur={() => runValidationTasks("teamAuditorGroup", teamAuditorGroup)}
        errorMessage={errors.teamAuditorGroup?.errorMessage}
        hasError={errors.teamAuditorGroup?.hasError}
        {...getOverrideProps(overrides, "teamAuditorGroup")}
      ></TextField>
      <TextField
        label="Team customer admin group"
        isRequired={false}
        isReadOnly={false}
        value={teamCustomerAdminGroup}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup: value,
              activationMode,
            };
            const result = onChange(modelFields);
            value = result?.teamCustomerAdminGroup ?? value;
          }
          if (errors.teamCustomerAdminGroup?.hasError) {
            runValidationTasks("teamCustomerAdminGroup", value);
          }
          setTeamCustomerAdminGroup(value);
        }}
        onBlur={() =>
          runValidationTasks("teamCustomerAdminGroup", teamCustomerAdminGroup)
        }
        errorMessage={errors.teamCustomerAdminGroup?.errorMessage}
        hasError={errors.teamCustomerAdminGroup?.hasError}
        {...getOverrideProps(overrides, "teamCustomerAdminGroup")}
      ></TextField>
      <TextField
        label="Activation mode"
        isRequired={false}
        isReadOnly={false}
        value={activationMode}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              id,
              duration,
              expiry,
              comments,
              ticketNo,
              approval,
              modifiedBy,
              sesNotificationsEnabled,
              snsNotificationsEnabled,
              slackNotificationsEnabled,
              slackAuditNotificationsChannel,
              sesSourceEmail,
              sesSourceArn,
              slackToken,
              teamAdminGroup,
              teamAuditorGroup,
              teamCustomerAdminGroup,
              activationMode: value,
            };
            const result = onChange(modelFields);
            value = result?.activationMode ?? value;
          }
          if (errors.activationMode?.hasError) {
            runValidationTasks("activationMode", value);
          }
          setActivationMode(value);
        }}
        onBlur={() => runValidationTasks("activationMode", activationMode)}
        errorMessage={errors.activationMode?.errorMessage}
        hasError={errors.activationMode?.hasError}
        {...getOverrideProps(overrides, "activationMode")}
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
          isDisabled={!(idProp || settingsModelProp)}
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
              !(idProp || settingsModelProp) ||
              Object.values(errors).some((e) => e?.hasError)
            }
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
