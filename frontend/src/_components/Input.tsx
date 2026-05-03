import { type InputHTMLAttributes, useState } from "react";
import { twMerge } from "tailwind-merge";
import { EyeClosedIcon, EyeOpenIcon } from "./Icons";

type InputProps = {
    className?: string;
    icon?: React.ReactNode;
    visible?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className, icon, type = "text", visible, placeholder, ...props }: InputProps) => {
    const [show, setShow] = useState<boolean>(visible ?? false);
    const isPassword = type === "password";

    return (
        <div
            className={twMerge(
                "focus-within:border-primary border-border-input bg-surface flex items-end gap-2 rounded border-2 px-3 py-2.5 transition-colors",
                className,
            )}
        >
            {icon && <span className="text-text-muted shrink-0">{icon}</span>}

            <input
                type={isPassword ? (show ? "text" : "password") : type}
                placeholder={placeholder}
                className="placeholder:text-text-muted bg-transparent text-sm outline-none w-full"
                {...props}
            />

            {isPassword && (
                <button
                    type="button"
                    onClick={() => setShow((prev) => !prev)}
                    className="text-text-muted hover:text-text-secondary shrink-0 transition-colors"
                >
                    {show ? <EyeOpenIcon /> : <EyeClosedIcon />}
                </button>
            )}
        </div>
    );
};

export default Input;
