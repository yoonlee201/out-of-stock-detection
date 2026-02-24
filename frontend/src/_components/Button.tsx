import { type ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type ButtonProps = {
    icon?: React.ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const Button = ({ className, icon, children, ...props }: ButtonProps) => (
    <button
        type="button"
        className={twMerge(
            "flex items-center justify-center gap-2 rounded px-4 py-3 text-sm font-bold tracking-widest uppercase transition-colors",
            className,
        )}
        {...props}
    >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
    </button>
);

export default Button;
