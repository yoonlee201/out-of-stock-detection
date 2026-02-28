import React from "react";
import Input from "./Input";

type FieldProps = {
    label: string;
    labelClassName?: string;
    inputClassName?: string;
    type?: string;
    icon?: React.ReactNode;
    placeholder?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

const Field = ({
    label,
    labelClassName,
    inputClassName,
    type = "text",
    icon,
    placeholder,
    required,
    ...rest
}: FieldProps) => (
    <div>
        <label className={`mb-1 block text-sm font-semibold ${labelClassName ?? ""}`}>
            {label}
            <span className="text-red-500">{required && " *"}</span>
        </label>
        <Input
            type={type}
            icon={icon}
            placeholder={placeholder ?? label}
            className={inputClassName}
            required={required}
            {...rest}
        />
    </div>
);

export default Field;
