import React from "react";
import { ChevronIcon } from "./Icons";

export interface Column<T extends string = string> {
    field: T;
    label: string;
    sortable?: boolean;
    className?: string;
}

export interface DataTableProps<SortField extends string = string> {
    columns: Column<SortField>[];
    sortField?: SortField;
    sortDir?: "asc" | "desc";
    onSort?: (field: SortField) => void;
    loading?: boolean;
    groupKeys?: string[];
    renderRows: ((groupKey: string) => React.ReactNode) | (() => React.ReactNode);
    actionColumn?: boolean;
}

export const FilterBar = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-surface mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow">
        {children}
    </div>
);

export const FilterGroup = ({
    options,
    value,
    onChange,
}: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}) => (
    <div className="bg-surface-muted flex flex-wrap gap-1 rounded-xl p-1">
        {options.map((opt) => (
            <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition"
                style={
                    value === opt.value
                        ? { backgroundColor: "var(--color-text)", color: "var(--color-background)" }
                        : { color: "var(--color-text-secondary)" }
                }
            >
                {opt.label}
            </button>
        ))}
    </div>
);

export const SearchInput = ({
    value,
    onChange,
    placeholder = "Search…",
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}) => (
    <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-surface-muted border-border text-text placeholder:text-text-muted rounded-xl border px-4 py-2 text-sm outline-none ${className ?? "min-w-45 flex-1"}`}
    />
);

export const SummaryCard = ({
    label,
    value,
    valueClass,
}: {
    label: string;
    value: number | string;
    valueClass?: string;
}) => (
    <div className="bg-surface rounded-xl p-5 shadow">
        <p className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
);

function DataTable<SortField extends string = string>({
    columns,
    sortField,
    sortDir,
    onSort,
    loading = false,
    groupKeys,
    renderRows,
    actionColumn = false,
}: DataTableProps<SortField>) {
    const colSpan = columns.length + (actionColumn ? 1 : 0);
    const isSortable = !!onSort;

    return (
        <div className="bg-surface rounded-xl shadow">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-border text-text-muted border-b text-xs font-semibold tracking-[0.14em] uppercase">
                            {columns.map(({ field, label, sortable = true, className }) => {
                                const canSort = isSortable && sortable;
                                return (
                                    <th
                                        key={field}
                                        onClick={canSort ? () => onSort!(field) : undefined}
                                        className={`px-5 py-4 ${canSort ? "cursor-pointer select-none" : ""} ${className ?? ""}`}
                                    >
                                        {label}
                                        {canSort && sortField === field && (
                                            <ChevronIcon
                                                className={`ml-1 inline h-3 w-3 transition-transform ${sortDir === "desc" ? "rotate-180" : ""
                                                    }`}
                                            />
                                        )}
                                    </th>
                                );
                            })}
                            {actionColumn && <th className="w-12 px-5 py-4" />}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={colSpan} className="text-text-muted py-20 text-center text-sm">
                                    Loading…
                                </td>
                            </tr>
                        ) : groupKeys ? (
                            groupKeys.map((key) => (
                                <React.Fragment key={key}>
                                    <tr className="border-border bg-surface-muted border-b">
                                        <td
                                            colSpan={colSpan}
                                            className="text-text-muted px-5 py-2 text-xs font-semibold tracking-[0.14em] uppercase"
                                        >
                                            {key}
                                        </td>
                                    </tr>
                                    {renderRows(key)}
                                </React.Fragment>
                            ))
                        ) : (
                            renderRows("all")
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DataTable;