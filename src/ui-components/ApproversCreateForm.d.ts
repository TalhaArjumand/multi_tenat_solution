/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

import * as React from "react";
import { GridProps, TextFieldProps } from "@aws-amplify/ui-react";
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
export declare type ApproversCreateFormInputValues = {
    name?: string;
    type?: string;
    approvers?: string[];
    groupIds?: string[];
    ticketNo?: string;
    modifiedBy?: string;
    customerId?: string;
    customerName?: string;
};
export declare type ApproversCreateFormValidationValues = {
    name?: ValidationFunction<string>;
    type?: ValidationFunction<string>;
    approvers?: ValidationFunction<string>;
    groupIds?: ValidationFunction<string>;
    ticketNo?: ValidationFunction<string>;
    modifiedBy?: ValidationFunction<string>;
    customerId?: ValidationFunction<string>;
    customerName?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type ApproversCreateFormOverridesProps = {
    ApproversCreateFormGrid?: PrimitiveOverrideProps<GridProps>;
    name?: PrimitiveOverrideProps<TextFieldProps>;
    type?: PrimitiveOverrideProps<TextFieldProps>;
    approvers?: PrimitiveOverrideProps<TextFieldProps>;
    groupIds?: PrimitiveOverrideProps<TextFieldProps>;
    ticketNo?: PrimitiveOverrideProps<TextFieldProps>;
    modifiedBy?: PrimitiveOverrideProps<TextFieldProps>;
    customerId?: PrimitiveOverrideProps<TextFieldProps>;
    customerName?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type ApproversCreateFormProps = React.PropsWithChildren<{
    overrides?: ApproversCreateFormOverridesProps | undefined | null;
} & {
    clearOnSuccess?: boolean;
    onSubmit?: (fields: ApproversCreateFormInputValues) => ApproversCreateFormInputValues;
    onSuccess?: (fields: ApproversCreateFormInputValues) => void;
    onError?: (fields: ApproversCreateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: ApproversCreateFormInputValues) => ApproversCreateFormInputValues;
    onValidate?: ApproversCreateFormValidationValues;
} & React.CSSProperties>;
export default function ApproversCreateForm(props: ApproversCreateFormProps): React.ReactElement;
