/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

import * as React from "react";
import { GridProps, TextAreaFieldProps, TextFieldProps } from "@aws-amplify/ui-react";
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
export declare type CustomersCreateFormInputValues = {
    name?: string;
    description?: string;
    accountIds?: string[];
    approverGroupIds?: string[];
    adminEmail?: string;
    adminName?: string;
    status?: string;
    settings?: string;
    createdAt?: string;
    modifiedBy?: string;
    metadata?: string;
    permissionSet?: string;
    roleStatus?: string;
    roleArn?: string;
    externalId?: string;
    cloudFormationTemplate?: string;
    invitationToken?: string;
    invitationSentAt?: string;
    invitationExpiresAt?: string;
    approvedAt?: string;
    roleEstablishedAt?: string;
    lastRoleVerification?: string;
    roleVerificationError?: string;
};
export declare type CustomersCreateFormValidationValues = {
    name?: ValidationFunction<string>;
    description?: ValidationFunction<string>;
    accountIds?: ValidationFunction<string>;
    approverGroupIds?: ValidationFunction<string>;
    adminEmail?: ValidationFunction<string>;
    adminName?: ValidationFunction<string>;
    status?: ValidationFunction<string>;
    settings?: ValidationFunction<string>;
    createdAt?: ValidationFunction<string>;
    modifiedBy?: ValidationFunction<string>;
    metadata?: ValidationFunction<string>;
    permissionSet?: ValidationFunction<string>;
    roleStatus?: ValidationFunction<string>;
    roleArn?: ValidationFunction<string>;
    externalId?: ValidationFunction<string>;
    cloudFormationTemplate?: ValidationFunction<string>;
    invitationToken?: ValidationFunction<string>;
    invitationSentAt?: ValidationFunction<string>;
    invitationExpiresAt?: ValidationFunction<string>;
    approvedAt?: ValidationFunction<string>;
    roleEstablishedAt?: ValidationFunction<string>;
    lastRoleVerification?: ValidationFunction<string>;
    roleVerificationError?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type CustomersCreateFormOverridesProps = {
    CustomersCreateFormGrid?: PrimitiveOverrideProps<GridProps>;
    name?: PrimitiveOverrideProps<TextFieldProps>;
    description?: PrimitiveOverrideProps<TextFieldProps>;
    accountIds?: PrimitiveOverrideProps<TextFieldProps>;
    approverGroupIds?: PrimitiveOverrideProps<TextFieldProps>;
    adminEmail?: PrimitiveOverrideProps<TextFieldProps>;
    adminName?: PrimitiveOverrideProps<TextFieldProps>;
    status?: PrimitiveOverrideProps<TextFieldProps>;
    settings?: PrimitiveOverrideProps<TextAreaFieldProps>;
    createdAt?: PrimitiveOverrideProps<TextFieldProps>;
    modifiedBy?: PrimitiveOverrideProps<TextFieldProps>;
    metadata?: PrimitiveOverrideProps<TextAreaFieldProps>;
    permissionSet?: PrimitiveOverrideProps<TextFieldProps>;
    roleStatus?: PrimitiveOverrideProps<TextFieldProps>;
    roleArn?: PrimitiveOverrideProps<TextFieldProps>;
    externalId?: PrimitiveOverrideProps<TextFieldProps>;
    cloudFormationTemplate?: PrimitiveOverrideProps<TextFieldProps>;
    invitationToken?: PrimitiveOverrideProps<TextFieldProps>;
    invitationSentAt?: PrimitiveOverrideProps<TextFieldProps>;
    invitationExpiresAt?: PrimitiveOverrideProps<TextFieldProps>;
    approvedAt?: PrimitiveOverrideProps<TextFieldProps>;
    roleEstablishedAt?: PrimitiveOverrideProps<TextFieldProps>;
    lastRoleVerification?: PrimitiveOverrideProps<TextFieldProps>;
    roleVerificationError?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type CustomersCreateFormProps = React.PropsWithChildren<{
    overrides?: CustomersCreateFormOverridesProps | undefined | null;
} & {
    clearOnSuccess?: boolean;
    onSubmit?: (fields: CustomersCreateFormInputValues) => CustomersCreateFormInputValues;
    onSuccess?: (fields: CustomersCreateFormInputValues) => void;
    onError?: (fields: CustomersCreateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: CustomersCreateFormInputValues) => CustomersCreateFormInputValues;
    onValidate?: CustomersCreateFormValidationValues;
} & React.CSSProperties>;
export default function CustomersCreateForm(props: CustomersCreateFormProps): React.ReactElement;
