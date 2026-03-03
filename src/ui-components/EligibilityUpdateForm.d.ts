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
export declare type EligibilityUpdateFormInputValues = {
    name?: string;
    type?: string;
    ticketNo?: string;
    approvalRequired?: boolean;
    duration?: string;
    modifiedBy?: string;
    customerId?: string;
    customerName?: string;
};
export declare type EligibilityUpdateFormValidationValues = {
    name?: ValidationFunction<string>;
    type?: ValidationFunction<string>;
    ticketNo?: ValidationFunction<string>;
    approvalRequired?: ValidationFunction<boolean>;
    duration?: ValidationFunction<string>;
    modifiedBy?: ValidationFunction<string>;
    customerId?: ValidationFunction<string>;
    customerName?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type EligibilityUpdateFormOverridesProps = {
    EligibilityUpdateFormGrid?: PrimitiveOverrideProps<GridProps>;
    name?: PrimitiveOverrideProps<TextFieldProps>;
    type?: PrimitiveOverrideProps<TextFieldProps>;
    ticketNo?: PrimitiveOverrideProps<TextFieldProps>;
    approvalRequired?: PrimitiveOverrideProps<SwitchFieldProps>;
    duration?: PrimitiveOverrideProps<TextFieldProps>;
    modifiedBy?: PrimitiveOverrideProps<TextFieldProps>;
    customerId?: PrimitiveOverrideProps<TextFieldProps>;
    customerName?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type EligibilityUpdateFormProps = React.PropsWithChildren<{
    overrides?: EligibilityUpdateFormOverridesProps | undefined | null;
} & {
    id?: string;
    eligibility?: any;
    onSubmit?: (fields: EligibilityUpdateFormInputValues) => EligibilityUpdateFormInputValues;
    onSuccess?: (fields: EligibilityUpdateFormInputValues) => void;
    onError?: (fields: EligibilityUpdateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: EligibilityUpdateFormInputValues) => EligibilityUpdateFormInputValues;
    onValidate?: EligibilityUpdateFormValidationValues;
} & React.CSSProperties>;
export default function EligibilityUpdateForm(props: EligibilityUpdateFormProps): React.ReactElement;
