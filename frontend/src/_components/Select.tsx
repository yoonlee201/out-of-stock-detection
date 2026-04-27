import {
    forwardRef,
    useEffect,
    useRef,
    useState,
    type SelectHTMLAttributes,
} from "react";
import { twMerge } from "tailwind-merge";

type Option = { value: string; label: string };

type SelectProps = {
    label?: string;
    labelClassName?: string;
    className?: string;
    selectClassName?: string;   // applied to the visible trigger button
    error?: string;
    variant?: "sm" | "md";
    options?: Option[];
    placeholder?: string;
    /** Show a search box at the top of the popover. Auto-on for >6 options. */
    searchable?: boolean;
} & SelectHTMLAttributes<HTMLSelectElement>;

const setNativeSelectValue = (el: HTMLSelectElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        "value",
    )?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    (
        {
            label,
            labelClassName,
            className,
            selectClassName,
            error,
            variant = "md",
            required,
            disabled,
            options = [],
            placeholder = "Select…",
            searchable,
            value,
            defaultValue,
            onChange,
            onBlur,
            ...rest
        },
        ref,
    ) => {
        const isControlled = value !== undefined;
        const [internalValue, setInternalValue] = useState<string>(
            (value as string) ?? (defaultValue as string) ?? "",
        );
        useEffect(() => {
            if (isControlled) setInternalValue((value as string) ?? "");
        }, [value, isControlled]);

        const [open, setOpen] = useState(false);
        const [search, setSearch] = useState("");
        const containerRef = useRef<HTMLDivElement>(null);
        const hiddenSelectRef = useRef<HTMLSelectElement>(null);
        const searchInputRef = useRef<HTMLInputElement>(null);

        const isSearchable = searchable ?? options.length > 6;

        useEffect(() => {
            if (open && isSearchable) searchInputRef.current?.focus();
            else setSearch("");
        }, [open, isSearchable]);

        useEffect(() => {
            if (!open) return;
            const handler = (e: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                    setOpen(false);
                }
            };
            document.addEventListener("mousedown", handler);
            return () => document.removeEventListener("mousedown", handler);
        }, [open]);

        const filtered = search.trim()
            ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
            : options;

        const currentLabel =
            options.find((o) => o.value === internalValue)?.label ?? "";

        // Forward the ref to the hidden <select> so react-hook-form (and any
        // other ref-based consumer) reads the real form value from a real
        // form element.
        const setRefs = (el: HTMLSelectElement | null) => {
            hiddenSelectRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as React.RefObject<HTMLSelectElement | null>).current = el;
        };

        const handlePick = (val: string) => {
            const el = hiddenSelectRef.current;
            if (el) setNativeSelectValue(el, val);
            // For uncontrolled callers we still need to update local state so
            // the trigger label reflects the choice immediately.
            if (!isControlled) setInternalValue(val);
            setOpen(false);
        };

        const triggerStyles =
            variant === "md"
                ? "bg-surface border-border-input focus-within:border-primary rounded border-2 py-2.5 pr-8 pl-3 text-sm"
                : "bg-surface-muted border-border rounded-xl border py-1.5 pr-7 pl-3 text-xs font-semibold";

        const popoverStyles =
            variant === "md"
                ? "rounded-xl"
                : "rounded-2xl";

        const trigger = (
            <div ref={containerRef} className={twMerge("relative", className)}>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setOpen((o) => !o)}
                    onBlur={onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={twMerge(
                        "text-text flex w-full items-center justify-between gap-2 transition-colors outline-none",
                        triggerStyles,
                        disabled && "cursor-not-allowed opacity-60",
                        selectClassName,
                    )}
                    style={{ color: currentLabel ? undefined : "var(--color-text-muted)" }}
                >
                    <span className="truncate text-left">
                        {currentLabel || placeholder}
                    </span>
                    <span className="text-text-muted pointer-events-none shrink-0">
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            className={`transition-transform ${open ? "rotate-180" : ""}`}
                        >
                            <path
                                d="M2 4l4 4 4-4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                </button>

                {/* Hidden native <select> — kept for form integration:
                    react-hook-form attaches its ref/name/onChange/onBlur here,
                    and a real change event lets RHF (and native form submit)
                    pick up the value picked from the popover above. */}
                <select
                    ref={setRefs}
                    {...(isControlled ? { value } : { defaultValue: defaultValue ?? "" })}
                    onChange={(e) => {
                        if (!isControlled) setInternalValue(e.target.value);
                        onChange?.(e);
                    }}
                    required={required}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                    {...rest}
                >
                    <option value="" disabled>
                        {placeholder}
                    </option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>

                {open && (
                    <div
                        className={twMerge(
                            "bg-surface border-border absolute top-full left-0 z-50 mt-1.5 w-full min-w-56 border shadow-xl",
                            popoverStyles,
                        )}
                        role="listbox"
                    >
                        {isSearchable && (
                            <div className="border-border border-b px-3 py-2">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="bg-surface-muted text-text placeholder:text-text-muted w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                                />
                            </div>
                        )}
                        <div className="max-h-60 overflow-y-auto p-1.5">
                            {filtered.length === 0 ? (
                                <p className="text-text-muted px-3 py-2 text-xs">No options.</p>
                            ) : (
                                filtered.map((o) => {
                                    const selected = o.value === internalValue;
                                    return (
                                        <button
                                            key={o.value}
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            onClick={() => handlePick(o.value)}
                                            className="hover:bg-surface-muted w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                            style={{
                                                color: selected
                                                    ? "var(--color-text)"
                                                    : "var(--color-text-secondary)",
                                            }}
                                        >
                                            {o.label}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        );

        if (!label) return trigger;

        return (
            <div>
                <label
                    className={twMerge(
                        "text-text-secondary mb-1 block text-sm font-semibold",
                        labelClassName,
                    )}
                >
                    {label}
                    {required && <span className="text-red"> *</span>}
                </label>
                {trigger}
                {error && <p className="text-red mt-1 text-sm">{error}</p>}
            </div>
        );
    },
);

Select.displayName = "Select";

export default Select;
