import { useEffect, useMemo, useRef, useState } from "react";
import { mockInventory } from "../mockData";
import Dialog from "../_components/Dialog";
import Field from "../_components/Field";
import type { InventoryItem, InventoryStatus } from "../types/inventory";
import { deriveCustomerAvailability, deriveStatus, QUANTITY_STATUS_FILTERS, QUANTITY_STATUS_LABEL, SHELF_STATUS_LABEL, shelfStatusClass } from "../utils/constants";
import { CustomerRow, EmployeeRow } from "../_components/InventoryRows";
import { useAuth } from "../hooks/useAuth";
import Loading from "../_components/Loading";

// this should be fetched from the backend in a real app, but hardcoded here for simplicity and to focus on UI/UX
const CATEGORIES = ["Soft Drinks", "Sports Drinks"];

interface EditForm {
    brand: string;
    productName: string;
    variant: string;
    size: string;
    category: string;
    stockCount: string;
}

const itemToForm = (item: InventoryItem): EditForm => ({
    brand: item.brand,
    productName: item.productName,
    variant: item.variant,
    size: item.size,
    category: item.category,
    stockCount: String(item.stockCount),
});

const Inventory = () => {
    const { user, loading } = useAuth();
    const view = user?.role === "customer" ? "customer" : "employee";

    const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");

    const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
    const [editForm, setEditForm] = useState<EditForm | null>(null);

    const summary = useMemo(() => {
        const statuses = inventory.map((i) => deriveStatus(i.stockCount));
        return {
            total: inventory.length,
            inStock: statuses.filter((s) => s === "in_stock").length,
            lowStock: statuses.filter((s) => s === "low_stock").length,
            outOfStock: statuses.filter((s) => s === "out_of_stock").length,
        };
    }, [inventory]);

    const filtered = useMemo(() => {
        return inventory.filter((item) => {
            const q = search.toLowerCase();
            const matchSearch =
                !q ||
                item.brand.toLowerCase().includes(q) ||
                item.productName.toLowerCase().includes(q) ||
                item.variant.toLowerCase().includes(q) ||
                item.size.toLowerCase().includes(q);
            const matchCategory = categoryFilter === "All" || item.category === categoryFilter;
            const matchStatus =
                view === "customer" || statusFilter === "all" || deriveStatus(item.stockCount) === statusFilter;
            return matchSearch && matchCategory && matchStatus;
        });
    }, [inventory, search, categoryFilter, statusFilter, view]);

    const openEdit = (item: InventoryItem) => {
        setEditTarget(item);
        setEditForm(itemToForm(item));
    };

    const closeEdit = () => {
        setEditTarget(null);
        setEditForm(null);
    };

    const saveEdit = () => {
        if (!editTarget || !editForm) return;
        const qty = Math.max(0, parseInt(editForm.stockCount, 10) || 0);
        setInventory((prev) =>
            prev.map((i) =>
                i.id === editTarget.id
                    ? {
                        ...i,
                        brand: editForm.brand.trim(),
                        productName: editForm.productName.trim(),
                        variant: editForm.variant.trim(),
                        size: editForm.size.trim(),
                        category: editForm.category.trim(),
                        stockCount: qty,
                        lastChecked: new Date(),
                    }
                    : i,
            ),
        );
        closeEdit();
    };

    const setField = (field: keyof EditForm, value: string) =>
        setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));

    if (loading || !user) return <Loading message="Checking authentication..." />;

    return (
        <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-semibold">Inventory</h1>
            </div>

            {view === "employee" && (
                <div className="mb-8 grid grid-cols-4 gap-4">
                    <SummaryCard label="Total Products" value={summary.total} />
                    <SummaryCard label="In Stock" value={summary.inStock} valueClass="text-green" />
                    <SummaryCard label="Low in Stock" value={summary.lowStock} valueClass="text-yellow" />
                    <SummaryCard label="Out of Stock" value={summary.outOfStock} valueClass="text-red" />
                </div>
            )}

            {/* Filters — customer view constrains search width to avoid stretching */}
            <div className="bg-surface mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow">
                <input
                    type="text"
                    placeholder="Search product..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`bg-surface-muted border-border text-text placeholder:text-text-muted rounded-xl border px-4 py-2 text-sm outline-none ${view === "employee" ? "min-w-45 flex-1" : "w-56"
                        }`}
                />
                <CategoryDropdown categories={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} />
                {view === "employee" && (
                    <FilterGroup
                        options={QUANTITY_STATUS_FILTERS.map((f) => f.label)}
                        value={QUANTITY_STATUS_LABEL[statusFilter as InventoryStatus] ?? "All"}
                        onChange={(label) => {
                            const match = QUANTITY_STATUS_FILTERS.find((f) => f.label === label);
                            if (match) setStatusFilter(match.value);
                        }}
                    />
                )}
            </div>

            {/* Table */}
            <div className="bg-surface rounded-xl shadow">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-border text-text-muted border-b text-xs font-semibold tracking-[0.14em] uppercase">
                                <th className="px-5 py-4">Product</th>
                                <th className="px-5 py-4">Category</th>
                                {view === "employee" ? (
                                    <>
                                        <th className="px-5 py-4">Stock</th>
                                        <th className="px-5 py-4">Quantity Status</th>
                                        <th className="px-5 py-4">Shelf Status</th>
                                        <th className="px-5 py-4">Last Checked</th>
                                        <th className="px-5 py-4">Actions</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-5 py-4">Stock</th>
                                        <th className="px-5 py-4">Availability</th>
                                        <th className="px-5 py-4">Last Checked</th>
                                        <th className="px-5 py-4"></th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={view === "employee" ? 7 : 6}
                                        className="text-text-muted py-16 text-center text-sm"
                                    >
                                        No products match your filters.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) =>
                                    view === "employee" ? (
                                        <EmployeeRow
                                            key={item.id}
                                            item={item}
                                            status={deriveStatus(item.stockCount)}
                                            onEdit={() => openEdit(item)}
                                        />
                                    ) : (
                                        <CustomerRow
                                            key={item.id}
                                            item={item}
                                            availability={deriveCustomerAvailability(item)}
                                        />
                                    ),
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit dialog — employee only */}
            <Dialog
                open={!!(editTarget && editForm)}
                title="Edit Product"
                description="Update product details and stock count. Shelf status is set automatically by shelf detection."
                onClose={closeEdit}
            >
                {editForm && editTarget && (
                    <div className="space-y-3">
                        <Field
                            label="Brand"
                            value={editForm.brand}
                            onChange={(e) => setField("brand", e.target.value)}
                        />
                        <Field
                            label="Product Name"
                            value={editForm.productName}
                            onChange={(e) => setField("productName", e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                label="Variant"
                                value={editForm.variant}
                                onChange={(e) => setField("variant", e.target.value)}
                            />
                            <Field
                                label="Size"
                                value={editForm.size}
                                onChange={(e) => setField("size", e.target.value)}
                            />
                        </div>

                        {/* Category — select not supported by Field, kept manual */}
                        <div>
                            <label className="text-text-secondary mb-1 block text-sm font-semibold">Category</label>
                            <select
                                value={editForm.category}
                                onChange={(e) => setField("category", e.target.value)}
                                className="input-base"
                            >
                                <option>Soft Drinks</option>
                                <option>Sports Drinks</option>
                            </select>
                        </div>

                        <Field
                            label="Stock Count"
                            type="number"
                            min={0}
                            value={editForm.stockCount}
                            onChange={(e) => setField("stockCount", e.target.value)}
                        />

                        <div className="bg-surface-muted rounded-xl px-4 py-3">
                            <p className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase">
                                Shelf Status
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${shelfStatusClass(editTarget.shelfStatus)}`}
                                >
                                    {SHELF_STATUS_LABEL[editTarget.shelfStatus]}
                                </span>
                                <span className="text-text-muted text-xs">Set by shelf detection</span>
                            </div>
                        </div>
                        <div className="mt-2 flex gap-3">
                            <button
                                type="button"
                                onClick={closeEdit}
                                className="bg-surface-muted text-text-secondary flex-1 rounded-xl px-4 py-3 font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveEdit}
                                className="bg-primary flex-1 rounded-xl px-4 py-3 font-semibold text-white transition hover:opacity-90"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </Dialog>
        </>
    );
};

const SummaryCard = ({ label, value, valueClass }: { label: string; value: number; valueClass?: string }) => (
    <div className="bg-surface rounded-xl p-5 shadow">
        <p className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
);

const FilterGroup = ({
    options,
    value,
    onChange,
}: {
    options: string[];
    value: string;
    onChange: (v: string) => void;
}) => (
    <div className="bg-surface-muted flex flex-wrap gap-1 rounded-xl p-1">
        {options.map((opt) => (
            <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                style={
                    value === opt
                        ? { backgroundColor: "var(--color-text)", color: "var(--color-background)" }
                        : { color: "var(--color-text-secondary)" }
                }
            >
                {opt}
            </button>
        ))}
    </div>
);

const CategoryDropdown = ({
    categories,
    value,
    onChange,
}: {
    categories: string[];
    value: string;
    onChange: (v: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Focus the search input when the dropdown opens
    useEffect(() => {
        if (open) {
            searchInputRef.current?.focus();
        } else {
            setSearch("");
        }
    }, [open]);

    // Close on outside click
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

    const filteredCategories = search.trim()
        ? categories.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
        : categories;

    const displayLabel = value === "All" ? "All Categories" : value;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="bg-surface-muted border-border flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                style={{ color: "var(--color-text-secondary)" }}
            >
                <span>{displayLabel}</span>
                <svg
                    width="12"
                    height="12"
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
            </button>

            {open && (
                <div className="bg-surface border-border absolute top-full left-0 z-20 mt-1.5 w-56 rounded-2xl border shadow-xl">
                    <div className="border-border border-b px-3 py-2">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-surface-muted text-text placeholder:text-text-muted w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto p-1.5">
                        <button
                            type="button"
                            onClick={() => { onChange("All"); setOpen(false); }}
                            className="hover:bg-surface-muted w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                            style={{ color: value === "All" ? "var(--color-text)" : "var(--color-text-secondary)" }}
                        >
                            All Categories
                        </button>
                        {filteredCategories.length === 0 ? (
                            <p className="text-text-muted px-3 py-2 text-xs">No categories found.</p>
                        ) : (
                            filteredCategories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => { onChange(cat); setOpen(false); }}
                                    className="hover:bg-surface-muted w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                    style={{ color: value === cat ? "var(--color-text)" : "var(--color-text-secondary)" }}
                                >
                                    {cat}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;