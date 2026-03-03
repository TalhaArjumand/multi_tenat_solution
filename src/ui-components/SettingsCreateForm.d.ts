/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

import * as React from "react";
import { GridProps, SwitchFieldProps, TextFieldProps } from "@aws-amplify/ui-react";
export declare type EscapeHatchProps = {
    [elementHierarchy: string]: Record<string, unknown>;
} | null;
export declare type VariantValues = {
    [key: string]: string;
};
export declare type Variant = {
    variantValues: VariantValues;
    overrides: EscapeHatchProps;
};
export declare type ValidationResponse = {
    hasError: boolean;
    errorMessage?: string;
};
export declare type ValidationFunction<T> = (value: T, validationResponse: ValidationResponse) => ValidationResponse | Promise<ValidationResponse>;
export declare type SettingsCreateFormInputValues = {
    id?: string;
    duration?: string;
    expiry?: string;
    comments?: boolean;
    ticketNo?: boolean;
    approval?: boolean;
    modifiedBy?: string;
    sesNotificationsEnabled?: boolean;
    snsNotificationsEnabled?: boolean;
    slackNotificationsEnabled?: boolean;
    slackAuditNotificationsChannel?: string;
    sesSourceEmail?: string;
    sesSourceArn?: string;
    slackToken?: string;
    teamAdminGroup?: string;
    teamAuditorGroup?: string;
    teamCustomerAdminGroup?: string;
    activationMode?: string;
};
export declare type SettingsCreateFormValidationValues = {
    id?: ValidationFunction<string>;
    duration?: ValidationFunction<string>;
    expiry?: ValidationFunction<string>;
    comments?: ValidationFunction<boolean>;
    ticketNo?: ValidationFunction<boolean>;
    approval?: ValidationFunction<boolean>;
    modifiedBy?: ValidationFunction<string>;
    sesNotificationsEnabled?: ValidationFunction<boolean>;
    snsNotificationsEnabled?: ValidationFunction<boolean>;
    slackNotificationsEnabled?: ValidationFunction<boolean>;
    slackAuditNotificationsChannel?: ValidationFunction<string>;
    sesSourceEmail?: ValidationFunction<string>;
    sesSourceArn?: ValidationFunction<string>;
    slackToken?: ValidationFunction<string>;
    teamAdminGroup?: ValidationFunction<string>;
    teamAuditorGroup?: ValidationFunction<string>;
    teamCustomerAdminGroup?: ValidationFunction<string>;
    activationMode?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type SettingsCreateFormOverridesProps = {
    SettingsCreateFormGrid?: PrimitiveOverrideProps<GridProps>;
    id?: PrimitiveOverrideProps<TextFieldProps>;
    duration?: PrimitiveOverrideProps<TextFieldProps>;
    expiry?: PrimitiveOverrideProps<TextFieldProps>;
    comments?: PrimitiveOverrideProps<SwitchFieldProps>;
    ticketNo?: PrimitiveOverrideProps<SwitchFieldProps>;
    approval?: PrimitiveOverrideProps<SwitchFieldProps>;
    modifiedBy?: PrimitiveOverrideProps<TextFieldProps>;
    sesNotificationsEnabled?: PrimitiveOverrideProps<SwitchFieldProps>;
    snsNotificationsEnabled?: PrimitiveOverrideProps<SwitchFieldProps>;
    slackNotificationsEnabled?: PrimitiveOverrideProps<SwitchFieldProps>;
    slackAuditNotificationsChannel?: PrimitiveOverrideProps<TextFieldProps>;
    sesSourceEmail?: PrimitiveOverrideProps<TextFieldProps>;
    sesSourceArn?: PrimitiveOverrideProps<TextFieldProps>;
    slackToken?: PrimitiveOverrideProps<TextFieldProps>;
    teamAdminGroup?: PrimitiveOverrideProps<TextFieldProps>;
    teamAuditorGroup?: PrimitiveOverrideProps<TextFieldProps>;
    teamCustomerAdminGroup?: PrimitiveOverrideProps<TextFieldProps>;
    activationMode?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type SettingsCreateFormProps = React.PropsWithChildren<{
    overrides?: SettingsCreateFormOverridesProps | undefined | null;
} & {
    clearOnSuccess?: boolean;
    onSubmit?: (fields: SettingsCreateFormInputValues) => SettingsCreateFormInputValues;
    onSuccess?: (fields: SettingsCreateFormInputValues) => void;
    onError?: (fields: SettingsCreateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: SettingsCreateFormInputValues) => SettingsCreateFormInputValues;
    onValidate?: SettingsCreateFormValidationValues;
} & React.CSSProperties>;
export default function SettingsCreateForm(props: SettingsCreateFormProps): React.ReactElement;
