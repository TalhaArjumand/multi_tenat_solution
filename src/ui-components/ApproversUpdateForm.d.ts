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
export declare type ApproversUpdateFormInputValues = {
    name?: string;
    type?: string;
    approvers?: string[];
    groupIds?: string[];
    ticketNo?: string;
    modifiedBy?: string;
    customerId?: string;
    customerName?: string;
};
export declare type ApproversUpdateFormValidationValues = {
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
export declare type ApproversUpdateFormOverridesProps = {
    ApproversUpdateFormGrid?: PrimitiveOverrideProps<GridProps>;
    name?: PrimitiveOverrideProps<TextFieldProps>;
    type?: PrimitiveOverrideProps<TextFieldProps>;
    approvers?: PrimitiveOverrideProps<TextFieldProps>;
    groupIds?: PrimitiveOverrideProps<TextFieldProps>;
    ticketNo?: PrimitiveOverrideProps<TextFieldProps>;
    modifiedBy?: PrimitiveOverrideProps<TextFieldProps>;
    customerId?: PrimitiveOverrideProps<TextFieldProps>;
    customerName?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type ApproversUpdateFormProps = React.PropsWithChildren<{
    overrides?: ApproversUpdateFormOverridesProps | undefined | null;
} & {
    id?: string;
    approvers?: any;
    onSubmit?: (fields: ApproversUpdateFormInputValues) => ApproversUpdateFormInputValues;
    onSuccess?: (fields: ApproversUpdateFormInputValues) => void;
    onError?: (fields: ApproversUpdateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: ApproversUpdateFormInputValues) => ApproversUpdateFormInputValues;
    onValidate?: ApproversUpdateFormValidationValues;
} & React.CSSProperties>;
export default function ApproversUpdateForm(props: ApproversUpdateFormProps): React.ReactElement;
