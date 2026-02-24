import { type InputHTMLAttributes, useState } from "react";
import { twMerge } from "tailwind-merge";
import { EyeClosedIcon, EyeOpenIcon } from "./Icons";

type InputProps = {
    className?: string;
    icon?: React.ReactNode;
    visible?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className, icon, type = "text", visible, placeholder, ...props }: InputProps) => {
    const [show, setShow] = useState<boolean>(visible ?? true);
    const isPassword = type === "password";

    return (
        <div
            className={twMerge(
                "focus-within:border-primary flex items-center gap-2 rounded border-2 border-transparent bg-white px-3 py-2.5 transition-colors",
                className,
            )}
        >
            {icon && <span className="shrink-0 text-gray-400">{icon}</span>}

            <input
                type={isPassword ? (show ? "text" : "password") : type}
                placeholder={placeholder}
                className="text-gray-700/ flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                {...props}
            />

            {isPassword && (
                <button
                    type="button"
                    onClick={() => setShow((prev) => !prev)}
                    className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
                >
                    {show ? <EyeOpenIcon /> : <EyeClosedIcon />}
                </button>
            )}
        </div>
    );
};

export default Input;
