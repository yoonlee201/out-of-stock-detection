import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "../_components/Dialog";
import Field from "../_components/Field";
import type { InventoryItem, InventoryStatus } from "../types/inventory";
import {
    deriveCustomerAvailability,
    deriveStatus,
    QUANTITY_STATUS_FILTERS,
    SHELF_STATUS_LABEL,
    shelfStatusClass,
} from "../utils/constants";
import { CustomerRow, EmployeeRow } from "../_components/InventoryRows";
import { useAuth } from "../hooks/useAuth";
import Loading from "../_components/Loading";
import { apiGetProducts, apiUpdateProduct } from "../api/query/products";
import { apiCreateReorder } from "../api/query/reorders";
import DataTable, { FilterBar, FilterGroup, SearchInput, SummaryCard } from "../_components/Table";

// ======================Constants========================
// TODO: fetch categories from backend instead of hardcoding
const CATEGORIES = ["Soft Drinks", "Sports Drinks"];

const INVENTORY_COLUMNS_EMPLOYEE = [
    { field: "product", label: "Product", sortable: false },
    { field: "category", label: "Category", sortable: false },
    { field: "aisle", label: "Aisle", sortable: false },
    { field: "shelf", label: "Shelf", sortable: false },
    { field: "stock", label: "Stock", sortable: false },
    { field: "quantityStatus", label: "Quantity Status", sortable: false },
    { field: "shelfStatus", label: "Shelf Status", sortable: false },
    { field: "lastChecked", label: "Last Checked", sortable: false },
    { field: "actions", label: "Actions", sortable: false },
];

const INVENTORY_COLUMNS_CUSTOMER = [
    { field: "product", label: "Product", sortable: false },
    { field: "category", label: "Category", sortable: false },
    { field: "aisle", label: "Aisle", sortable: false },
    { field: "shelf", label: "Shelf", sortable: false },
    { field: "stock", label: "Stock", sortable: false },
    { field: "availability", label: "Availability", sortable: false },
    { field: "lastChecked", label: "Last Checked", sortable: false },
    { field: "actions", label: "", sortable: false },
];

const QUANTITY_STATUS_OPTIONS = QUANTITY_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }));

// ======================Types========================

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

// ======================Main Inventory Component========================

const Inventory = () => {
    const { user, loading } = useAuth();
    const view = user?.role === "customer" ? "customer" : "employee";

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [inventoryError, setInventoryError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        setInventoryLoading(true);
        setInventoryError(null);
        
        apiGetProducts()
            .then((inventory) => setInventory(inventory ?? []))
            .catch((e: Error) => setInventoryError(e.message))
            .finally(() => setInventoryLoading(false));
    }, [user]);

    const summary = useMemo(() => {
        const statuses = inventory.map((i) => deriveStatus(i.stockCount));
        return {
            total: inventory.length,
            inStock: statuses.filter((s) => s === "in_stock").length,
            lowStock: statuses.filter((s) => s === "low_stock").length,
            outOfStock: statuses.filter((s) => s === "out_of_stock").length,
        };
    }, [inventory]);

    if (loading || !user) return <Loading message="Checking authentication..." />;
    if (inventoryLoading) return <Loading message="Loading inventory..." />;
    if (inventoryError) return <p className="text-red text-sm">{inventoryError}</p>;

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

            <InventoryTable view={view} inventory={inventory} setInventory={setInventory} />
        </>
    );
};

// ======================Inventory Table========================

type InventoryTableProps = {
    view: "employee" | "customer";
    inventory: InventoryItem[];
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
};

const InventoryTable = ({ view, inventory, setInventory }: InventoryTableProps) => {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");
    const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
    const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null);

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

    const renderRows = () => {
        if (filtered.length === 0) {
            return (
                <tr key="empty">
                    <td colSpan={view === "employee" ? 9 : 8} className="text-text-muted py-16 text-center text-sm">
                        No products match your filters.
                    </td>
                </tr>
            );
        }
        return filtered.map((item) =>
            view === "employee" ? (
                <EmployeeRow
                    key={item.id}
                    item={item}
                    status={deriveStatus(item.stockCount)}
                    onEdit={() => setEditTarget(item)}
                    onReorder={() => setReorderTarget(item)}
                />
            ) : (
                <CustomerRow key={item.id} item={item} availability={deriveCustomerAvailability(item)} />
            ),
        );
    };

    const columns = view === "employee" ? INVENTORY_COLUMNS_EMPLOYEE : INVENTORY_COLUMNS_CUSTOMER;

    return (
        <>
            <FilterBar>
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search product…"
                    className={view === "employee" ? "w-1/3" : "w-56"}
                />
                <CategoryDropdown categories={CATEGORIES} value={categoryFilter} onChange={setCategoryFilter} />
                {view === "employee" && (
                    <FilterGroup
                        options={QUANTITY_STATUS_OPTIONS}
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v as InventoryStatus | "all")}
                    />
                )}
            </FilterBar>

            <DataTable columns={columns} renderRows={renderRows} />

            <EditProductDialog target={editTarget} setInventory={setInventory} onClose={() => setEditTarget(null)} />
            <ReorderDialog target={reorderTarget} onClose={() => setReorderTarget(null)} />
        </>
    );
};

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

    useEffect(() => {
        if (open) searchInputRef.current?.focus();
        else setSearch("");
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const filteredCategories = search.trim()
        ? categories.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
        : categories;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="bg-surface-muted border-border flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                style={{ color: "var(--color-text-secondary)" }}
            >
                <span>{value === "All" ? "All Categories" : value}</span>
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
                            onClick={() => {
                                onChange("All");
                                setOpen(false);
                            }}
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
                                    onClick={() => {
                                        onChange(cat);
                                        setOpen(false);
                                    }}
                                    className="hover:bg-surface-muted w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                    style={{
                                        color: value === cat ? "var(--color-text)" : "var(--color-text-secondary)",
                                    }}
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
// ======================Dialogs========================

type EditProductDialogProps = {
    target: InventoryItem | null;
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    onClose: () => void;
};

const EditProductDialog = ({ target, setInventory, onClose }: EditProductDialogProps) => {
    const [form, setForm] = useState<EditForm | null>(null);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (target) setForm(itemToForm(target));
    }, [target]);

    const setField = (field: keyof EditForm, value: string) =>
        setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

    const handleSave = async () => {
        if (!target || !form) return;
        const qty = Math.max(0, parseInt(form.stockCount, 10) || 0);
        setSaveLoading(true);
        setSaveError(null);
        try {
            const updated = await apiUpdateProduct(target.id, {
                name: form.productName.trim(),
                brand: form.brand.trim(),
                variant: form.variant.trim(),
                size: form.size.trim(),
                type: form.category.trim(),
                quantity_in_store: qty,
            });
            setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            onClose();
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Failed to save.");
        } finally {
            setSaveLoading(false);
        }
    };

    return (
        <Dialog
            open={!!target}
            title="Edit Product"
            description="Update product details and stock count. Shelf status is set automatically by shelf detection."
            onClose={onClose}
        >
            {form && target && (
                <div className="space-y-3">
                    <Field label="Brand" value={form.brand} onChange={(e) => setField("brand", e.target.value)} />
                    <Field
                        label="Product Name"
                        value={form.productName}
                        onChange={(e) => setField("productName", e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            label="Variant"
                            value={form.variant}
                            onChange={(e) => setField("variant", e.target.value)}
                        />
                        <Field label="Size" value={form.size} onChange={(e) => setField("size", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-text-secondary mb-1 block text-sm font-semibold">Category</label>
                        <select
                            value={form.category}
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
                        value={form.stockCount}
                        onChange={(e) => setField("stockCount", e.target.value)}
                    />
                    <div className="bg-surface-muted rounded-xl px-4 py-3">
                        <p className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase">
                            Shelf Status
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${shelfStatusClass(target.shelfStatus)}`}
                            >
                                {SHELF_STATUS_LABEL[target.shelfStatus]}
                            </span>
                            <span className="text-text-muted text-xs">Set by shelf detection</span>
                        </div>
                    </div>
                    {saveError && <p className="text-red text-xs">{saveError}</p>}
                    <div className="mt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-surface-muted text-text-secondary flex-1 rounded-xl px-4 py-3 font-semibold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saveLoading}
                            className="bg-primary flex-1 rounded-xl px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                            {saveLoading ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}
        </Dialog>
    );
};

type ReorderDialogProps = {
    target: InventoryItem | null;
    onClose: () => void;
};

const ReorderDialog = ({ target, onClose }: ReorderDialogProps) => {
    const [qty, setQty] = useState("50");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // reset state each time a new item is targeted
    useEffect(() => {
        if (target) {
            setQty("50");
            setError(null);
            setSuccess(false);
        }
    }, [target]);

    const handleSubmit = async () => {
        if (!target) return;
        const quantity = Math.max(1, parseInt(qty, 10) || 1);
        setLoading(true);
        setError(null);
        try {
            await apiCreateReorder(target.id, quantity);
            setSuccess(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create reorder.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={!!target}
            title="Create Reorder"
            description={
                target ? `Reorder ${target.brand} ${target.productName} (${target.variant} · ${target.size})` : ""
            }
            onClose={onClose}
        >
            {target && (
                <div className="space-y-3">
                    {success ? (
                        <div className="space-y-3">
                            <p className="text-green text-sm font-semibold">Reorder created successfully.</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="bg-surface-muted text-text-secondary w-full rounded-xl px-4 py-3 font-semibold transition"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <>
                            <Field
                                label="Quantity"
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                            />
                            {error && <p className="text-red text-xs">{error}</p>}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="bg-surface-muted text-text-secondary flex-1 rounded-xl px-4 py-3 font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="bg-primary flex-1 rounded-xl px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {loading ? "Submitting…" : "Submit Reorder"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Dialog>
    );
};


export default Inventory;
