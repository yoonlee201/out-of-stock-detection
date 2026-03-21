import { useRef, useEffect, useState } from "react";

interface DropdownOption {
    value: string;
    label: string;
}

interface DropdownProps {
    label: string;
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    sectionLabel?: string;
}

const Dropdown = ({ label, options, value, onChange, sectionLabel }: DropdownProps) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const active = options.find((o) => o.value === value);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
                    value !== options[0].value
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800"
                }`}
            >
                {label}
                {value !== options[0].value && `: ${active?.label}`}
                <svg className="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="p-1.5">
                        {sectionLabel && (
                            <p className="px-2 py-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                                {sectionLabel}
                            </p>
                        )}
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm capitalize transition-colors ${
                                    value === option.value
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                {value === option.value && (
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                )}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dropdown;
