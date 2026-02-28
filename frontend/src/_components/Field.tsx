import React from "react";
import Input from "./Input";

type FieldProps = {
    label: string;
    labelClassName?: string;
    inputClassName?: string;
    type?: string;
    icon?: React.ReactNode;
    placeholder?: string;
    animationDelay?: string;
    error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

const Field = ({
    label,
    labelClassName,
    inputClassName,
    type = "text",
    icon,
    placeholder,
    required=false,
    animationDelay,
    error,
    ...rest
}: FieldProps) => (
    <div className='anim-item' style={{ animationDelay: animationDelay ?? "0s" }}>
        <style>{`
            `}</style>
        <label className={`mb-1 block text-sm font-semibold text-gray-600 ${labelClassName ?? ""}`}>
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
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
);

export default Field;
