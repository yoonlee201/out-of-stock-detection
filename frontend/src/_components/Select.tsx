import { type SelectHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type SelectProps = {
    label?: string;
    labelClassName?: string;
    className?: string;
    selectClassName?: string;
    error?: string;
    variant?: "sm" | "md";
    options?: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>;

const Select = ({
    label,
    labelClassName,
    className,
    selectClassName,
    error,
    variant = "md",
    required,
    options,
    ...props
}: SelectProps) => {
    const control = (
        <div
            className={twMerge(
                "relative flex items-center",
                variant === "md"
                    ? "focus-within:border-primary border-border-input bg-surface rounded border-2 transition-colors"
                    : "border-border bg-surface-muted rounded-xl border",
                className,
            )}
        >
            <select
                required={required}
                className={twMerge(
                    "text-text w-full appearance-none bg-transparent outline-none",
                    variant === "md" ? "py-2.5 pr-8 pl-3 text-sm" : "py-1.5 pr-7 pl-3 text-xs font-semibold",
                    selectClassName,
                )}
                {...props}
            >
                {options?.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <span className="text-text-muted pointer-events-none absolute right-2.5 shrink-0">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                        d="M2 4l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
        </div>
    );

    if (!label) return control;

    return (
        <div>
            <label className={twMerge("text-text-secondary mb-1 block text-sm font-semibold", labelClassName)}>
                {label}
                {required && <span className="text-red"> *</span>}
            </label>
            {control}
            {error && <p className="text-red mt-1 text-sm">{error}</p>}
        </div>
    );
};

export default Select;
