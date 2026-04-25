import React, { useState, useEffect } from "react";
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
    /** Called with (groupKey, page, pageSize) — page/pageSize only in flat (non-grouped) mode. */
    renderRows: (groupKey: string, page?: number, pageSize?: number) => React.ReactNode;
    actionColumn?: boolean;
    /** Initial rows-per-page value. DataTable manages pageSize state internally. Defaults to 10. */
    defaultPageSize?: number;
    /** Total filtered item count — used to compute page count and the "X–Y of Z" label. */
    totalItems?: number;
    /** Change this value to reset the page back to 1 (e.g. pass a filter-state key). */
    resetKey?: unknown;
}

export const FilterBar = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-surface mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow">{children}</div>
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

// ── Internal pagination helpers ───────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | "gap")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const result: (number | "gap")[] = [1];
    if (current > 3) result.push("gap");
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) result.push(p);
    if (current < total - 2) result.push("gap");
    result.push(total);
    return result;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

interface PaginationBarProps {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPage: (p: number) => void;
    onPageSize: (n: number) => void;
}

function PaginationBar({ page, totalPages, total, pageSize, onPage, onPageSize }: PaginationBarProps) {
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            {/* Left: rows-per-page selector + range label */}
            <div className="flex items-center gap-3">
                <label className="text-text-muted flex items-center gap-1.5 text-xs">
                    Rows per page
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSize(Number(e.target.value))}
                        className="bg-surface-muted border-border text-text rounded-lg border px-2 py-1 text-xs font-semibold"
                    >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </label>
                <span className="text-text-muted text-xs">
                    {from}–{to} of {total}
                </span>
            </div>

            {/* Right: page buttons — only shown when there is more than one page */}
            <div className={`flex items-center gap-0.5 ${totalPages <= 1 ? "invisible" : ""}`}>
                <button
                    type="button"
                    onClick={() => onPage(page - 1)}
                    disabled={page === 1}
                    className="text-text-secondary hover:bg-surface-muted rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-30"
                >
                    ‹
                </button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                    p === "gap" ? (
                        <span key={`gap-${i}`} className="text-text-muted px-1.5 text-xs">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPage(p)}
                            className="min-w-7 rounded-lg px-2 py-1.5 text-xs font-semibold transition"
                            style={
                                p === page
                                    ? { backgroundColor: "var(--color-text)", color: "var(--color-background)" }
                                    : { color: "var(--color-text-secondary)" }
                            }
                        >
                            {p}
                        </button>
                    ),
                )}
                <button
                    type="button"
                    onClick={() => onPage(page + 1)}
                    disabled={page === totalPages}
                    className="text-text-secondary hover:bg-surface-muted rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-30"
                >
                    ›
                </button>
            </div>
        </div>
    );
}

// ── DataTable ─────────────────────────────────────────────────────────────────

function DataTable<SortField extends string = string>({
    columns,
    sortField,
    sortDir,
    onSort,
    loading = false,
    groupKeys,
    renderRows,
    actionColumn = false,
    defaultPageSize = 10,
    totalItems,
    resetKey,
}: DataTableProps<SortField>) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);

    // Reset to page 1 whenever the caller signals a filter/search change or page size changes.
    useEffect(() => { setPage(1); }, [resetKey, pageSize]);

    const isPaginated = !groupKeys && totalItems !== undefined;
    const totalPages = isPaginated ? Math.max(1, Math.ceil(totalItems! / pageSize)) : 1;
    // Clamp so the page never points past the last page after filtering.
    const clampedPage = isPaginated ? Math.min(page, totalPages) : 1;

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
                                                className={`ml-1 inline h-3 w-3 transition-transform ${
                                                    sortDir === "desc" ? "rotate-180" : ""
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
                            // Grouped mode — no pagination, no page/pageSize passed.
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
                            // Flat mode — pass current page + pageSize so the caller can slice.
                            renderRows("all", clampedPage, pageSize)
                        )}
                    </tbody>
                </table>
            </div>
            {isPaginated && (
                <PaginationBar
                    page={clampedPage}
                    totalPages={totalPages}
                    total={totalItems!}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={setPageSize}
                />
            )}
        </div>
    );
}

export default DataTable;
