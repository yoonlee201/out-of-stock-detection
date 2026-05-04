import { useEffect, useRef, useState } from "react";
import Checkbox from "./Checkbox";

const CheckboxDropdown = ({
    label,
    options,
    selected,
    onChange,
    disabled = false,
    formatOption,
}: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    disabled?: boolean;
    formatOption?: (opt: string) => string;
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const summary =
        selected.length === 0
            ? "None selected"
            : selected.length === options.length
              ? "All"
              : selected.map((s) => (formatOption ? formatOption(s) : s)).join(", ");

    return (
        <div ref={containerRef} className="relative">
            <p className="text-text-secondary mb-1.5 text-sm font-semibold">{label}</p>
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (!disabled) setOpen((o) => !o);
                }}
                className={`border-border bg-surface flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${disabled ? "cursor-default opacity-60" : "hover:bg-surface-muted cursor-pointer"}`}
            >
                <span className={selected.length === 0 ? "text-text-muted" : "text-text-secondary"}>{summary}</span>
                {!disabled && <span className="text-text-muted ml-2 text-xs">{open ? "▴" : "▾"}</span>}
            </button>
            {open && (
                <div className="border-border bg-surface absolute right-0 left-0 z-50 mt-1 max-h-44 overflow-y-auto rounded-xl border shadow-lg">
                    {options.map((opt) => {
                        const checked = selected.includes(opt);
                        const display = formatOption ? formatOption(opt) : opt;
                        return (
                            <label
                                key={opt}
                                className="border-border text-text-secondary hover:bg-surface-muted flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-sm select-none last:border-b-0"
                            >
                                <Checkbox
                                    checked={checked}
                                    onChange={() => {
                                        const next = checked
                                            ? selected.filter((s) => s !== opt)
                                            : [...selected, opt].sort((a, b) => parseInt(a) - parseInt(b));
                                        onChange(next);
                                    }}
                                />
                                {display}
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CheckboxDropdown;
