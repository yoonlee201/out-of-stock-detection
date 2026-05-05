import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "../_components/Dialog";
import Field from "../_components/Field";
import type { InventoryItem, InventoryStatus } from "../types/inventory";
import {
    CUSTOMER_AVAILABILITY_LABEL,
    deriveCustomerAvailability,
    deriveStatus,
    QUANTITY_STATUS_FILTERS,
    QUANTITY_STATUS_LABEL,
    SHELF_STATUS_LABEL,
    shelfStatusClass,
} from "../utils/constants";
import { CustomerRow, EmployeeRow } from "../_components/InventoryRows";
import { useAuth } from "../hooks/useAuth";
import Loading from "../_components/Loading";
import { apiCreateProduct, apiDeleteProduct, apiGetProducts, apiUpdateProduct, apiUploadProductsCsv } from "../api/query/products";
import { apiCreateReorder } from "../api/query/reorders";
import DataTable, { FilterBar, FilterGroup, SearchInput, SummaryCard } from "../_components/Table";
import { PlusIcon } from "../_components/Icons";
import Select from "../_components/Select";
import CheckboxDropdown from "../_components/CheckboxDropdown";

type SortField =
    | "product"
    | "category"
    | "aisle"
    | "shelf"
    | "stock"
    | "quantityStatus"
    | "shelfStatus"
    | "lastChecked"
    | "availability";
type GroupField = "none" | "product" | "category" | "quantityStatus" | "shelfStatus" | "availability";

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
    { value: "none", label: "No grouping" },
    { value: "product", label: "Product" },
    { value: "category", label: "Category" },
    { value: "quantityStatus", label: "Quantity Status" },
    { value: "shelfStatus", label: "Shelf Status" },
    { value: "availability", label: "Availability" },
];

const sortValue = (item: InventoryItem, field: SortField): string | number => {
    switch (field) {
        case "product":
            return `${item.brand} ${item.productName}`.toLowerCase();
        case "category":
            return item.category.toLowerCase();
        case "aisle":
            return item.aisle;
        case "shelf":
            return item.shelf;
        case "stock":
            return item.stockCount;
        case "quantityStatus":
            return deriveStatus(item.stockCount, item.originalStock);
        case "shelfStatus":
            return item.shelfStatus;
        case "lastChecked":
            return item.lastChecked.getTime();
        case "availability":
            return deriveCustomerAvailability(item);
    }
};

const groupKeyOf = (item: InventoryItem, field: GroupField): string => {
    switch (field) {
        case "product":
            return `${item.brand} ${item.productName}`.trim() || "Unknown";
        case "category":
            return item.category || "Uncategorized";
        case "quantityStatus":
            return QUANTITY_STATUS_LABEL[deriveStatus(item.stockCount, item.originalStock)];
        case "shelfStatus":
            return SHELF_STATUS_LABEL[item.shelfStatus];
        case "availability":
            return CUSTOMER_AVAILABILITY_LABEL[deriveCustomerAvailability(item)];
        case "none":
            return "";
    }
};

// ======================Constants========================
// TODO: fetch categories from backend instead of hardcoding
// const CATEGORIES = ["Soft Drinks", "Sports Drinks"];
const AISLES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SHELVES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const POSITIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const INVENTORY_COLUMNS_EMPLOYEE = [
    { field: "product", label: "Product", sortable: true },
    { field: "category", label: "Category", sortable: true },
    { field: "aisle", label: "Aisle", sortable: true },
    { field: "shelf", label: "Shelf", sortable: true },
    { field: "stock", label: "Stock", sortable: true },
    { field: "quantityStatus", label: "Quantity Status", sortable: true },
    { field: "shelfStatus", label: "Shelf Status", sortable: true },
    { field: "lastChecked", label: "Last Checked", sortable: true },
    { field: "actions", label: "", sortable: false },
];

const INVENTORY_COLUMNS_CUSTOMER = [
    { field: "product", label: "Product", sortable: true },
    { field: "category", label: "Category", sortable: true },
    { field: "aisle", label: "Aisle", sortable: true },
    { field: "shelf", label: "Shelf", sortable: true },
    { field: "stock", label: "Stock", sortable: true },
    { field: "quantityStatus", label: "Quantity Status", sortable: true },
    { field: "lastChecked", label: "Last Checked", sortable: true },
    { field: "actions", label: "", sortable: false },
];

const QUANTITY_STATUS_OPTIONS = QUANTITY_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }));

// ======================Types========================

type EditForm = {
    brand: string;
    productName: string;
    variant: string;
    size: string;
    category: string;
    aisle: string;
    shelf: string;
    stockCount: string;
};

const itemToForm = (item: InventoryItem): EditForm => ({
    brand: item.brand,
    productName: item.productName,
    variant: item.variant,
    size: item.size,
    category: item.category,
    aisle: item.aisle === "—" ? AISLES[0] : item.aisle,
    shelf: item.shelf === "—" ? SHELVES[0] : item.shelf,
    stockCount: String(item.stockCount),
});

// ======================Main Inventory Component========================

const Inventory = () => {
    const { user, loading } = useAuth();
    const view = user?.role === "customer" ? "customer" : "employee";

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [inventoryError, setInventoryError] = useState<string | null>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [csvUploading, setCsvUploading] = useState(false);
    const csvInputRef = useRef<HTMLInputElement | null>(null);

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
        const statuses = inventory.map((i) => deriveStatus(i.stockCount, i.originalStock));
        return {
            total: inventory.length,
            inStock: statuses.filter((s) => s === "in_stock").length,
            lowStock: statuses.filter((s) => s === "low_stock").length,
            outOfStock: statuses.filter((s) => s === "out_of_stock").length,
        };
    }, [inventory]);

    const handleCsvUpload = async (file: File) => {
        setCsvUploading(true);
        setInventoryError(null);

        try {
            const result = await apiUploadProductsCsv(file);
            const refreshed = await apiGetProducts();
            setInventory(refreshed ?? []);
            alert(`CSV uploaded successfully. Added ${result.added_count} products.`);
        } catch (e) {
            alert(e instanceof Error ? e.message : "CSV upload failed.");
        } finally {
            setCsvUploading(false);
            if (csvInputRef.current) csvInputRef.current.value = "";
        }
    };

    const categories = useMemo(() => [...new Set(inventory.map((item) => item.category))].sort(), [inventory]);

    if (loading || !user) return <Loading message="Checking authentication..." fullscreen={false} />;
    if (inventoryLoading) return <Loading message="Loading inventory..." fullscreen={false} />;
    if (inventoryError) return <p className="text-red text-sm">{inventoryError}</p>;

    return (
        <div className="px-8 py-6">
            <header className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-semibold">Inventory</h1>
                    <p className="text-text-muted mt-0.5 text-sm">
                        {" "}
                        Manage your product inventory and track stock levels
                    </p>
                </div>
                {view === "employee" && (
                    <div className="flex items-center gap-2">
                        <input
                            ref={csvInputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCsvUpload(file);
                            }}
                        />

                        <button
                            type="button"
                            onClick={() => csvInputRef.current?.click()}
                            disabled={csvUploading}
                            className="hover:bg-primary-hover bg-primary inline-flex items-center gap-2 rounded-full px-2.5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 lg:rounded-xl lg:px-4"
                        >
                            <span className="hidden lg:block">{csvUploading ? "Uploading..." : "Upload CSV"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setAddDialogOpen(true)}
                            className="hover:bg-primary-hover bg-primary inline-flex items-center gap-2 rounded-full px-2.5 py-2.5 text-sm font-semibold text-white transition-colors lg:rounded-xl lg:px-4"
                        >
                            <PlusIcon />
                            <span className="hidden lg:block">Add Item</span>
                        </button>
                    </div>
                )}
            </header>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryCard label="Total Products" value={summary.total} />
                <SummaryCard label="In Stock" value={summary.inStock} valueClass="text-green" />
                <SummaryCard label="Low in Stock" value={summary.lowStock} valueClass="text-yellow" />
                <SummaryCard label="Out of Stock" value={summary.outOfStock} valueClass="text-red" />
            </div>

            <InventoryTable view={view} inventory={inventory} setInventory={setInventory} categories={categories} />

            <AddProductDialog
                categories={categories}
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onCreated={(item) => setInventory((prev) => [...prev, item])}
            />
        </div>
    );
};

// ======================Inventory Table========================

type InventoryTableProps = {
    view: "employee" | "customer";
    inventory: InventoryItem[];
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    categories: string[];
};

const InventoryTable = ({ view, inventory, setInventory, categories }: InventoryTableProps) => {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");
    const [sortField, setSortField] = useState<SortField>("product");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [groupBy, setGroupBy] = useState<GroupField>("none");
    const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
    const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

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
                view === "customer" ||
                statusFilter === "all" ||
                deriveStatus(item.stockCount, item.originalStock) === statusFilter;
            return matchSearch && matchCategory && matchStatus;
        });
    }, [inventory, search, categoryFilter, statusFilter, view]);

    // When grouping is on, sort by group key first so items in the same group
    // stay contiguous across the paginated slice. Without this, the slice would
    // interleave groups and the inline headers would re-emit the same group
    // multiple times per page.
    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            if (groupBy !== "none") {
                const gA = groupKeyOf(a, groupBy);
                const gB = groupKeyOf(b, groupBy);
                if (gA < gB) return -1;
                if (gA > gB) return 1;
            }
            const av = sortValue(a, sortField);
            const bv = sortValue(b, sortField);
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [filtered, sortField, sortDir, groupBy]);

    const handleSort = (field: SortField) => {
        if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const columns = view === "employee" ? INVENTORY_COLUMNS_EMPLOYEE : INVENTORY_COLUMNS_CUSTOMER;
    const colSpan = columns.length;

    const renderRows = (page: number, pageSize: number) => {
        const items = sorted.slice((page - 1) * pageSize, page * pageSize);
        if (items.length === 0) {
            return (
                <tr key="empty">
                    <td colSpan={colSpan} className="text-text-muted py-16 text-center text-sm">
                        No products found.
                    </td>
                </tr>
            );
        }

        const out: React.ReactNode[] = [];
        let prevGroup: string | null = null;
        items.forEach((item) => {
            if (groupBy !== "none") {
                const k = groupKeyOf(item, groupBy);
                if (k !== prevGroup) {
                    out.push(
                        <tr key={`hdr-${k}`} className="border-border bg-surface-muted border-b">
                            <td
                                colSpan={colSpan}
                                className="text-text-muted px-5 py-2 text-xs font-semibold tracking-[0.14em] uppercase"
                            >
                                {k}
                            </td>
                        </tr>,
                    );
                    prevGroup = k;
                }
            }
            out.push(
                view === "employee" ? (
                    <EmployeeRow
                        key={item.id}
                        item={item}
                        status={deriveStatus(item.stockCount, item.originalStock)}
                        onEdit={() => setEditTarget(item)}
                        onReorder={() => setReorderTarget(item)}
                        onDelete={() => setDeleteTarget(item)}
                    />
                ) : (
                    <CustomerRow key={item.id} item={item} status={deriveStatus(item.stockCount, item.originalStock)} />
                ),
            );
        });
        return out;
    };

    const groupOptions =
        view === "customer"
            ? GROUP_OPTIONS.filter((o) => o.value !== "shelfStatus" && o.value !== "availability")
            : GROUP_OPTIONS.filter((o) => o.value !== "shelfStatus" && o.value !== "availability");

    return (
        <>
            <FilterBar>
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search product…"
                    className={view === "employee" ? "w-1/3" : "w-56"}
                />
                <CategoryDropdown categories={categories} value={categoryFilter} onChange={setCategoryFilter} />
                {view === "employee" && (
                    <FilterGroup
                        options={QUANTITY_STATUS_OPTIONS}
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v as InventoryStatus | "all")}
                    />
                )}
                <label className="ml-auto flex items-center gap-2 text-xs font-semibold">
                    <span className="text-text-muted tracking-[0.14em] uppercase">Group by</span>
                    <Select
                        variant="sm"
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as GroupField)}
                        options={groupOptions.map((o) => ({ value: o.value, label: o.label }))}
                    />
                </label>
            </FilterBar>

            <DataTable<SortField>
                columns={columns as { field: SortField; label: string; sortable: boolean }[]}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                renderRows={renderRows}
                totalItems={sorted.length}
                resetKey={`${search}-${categoryFilter}-${statusFilter}-${groupBy}`}
            />

            <EditProductDialog
                target={editTarget}
                setInventory={setInventory}
                onClose={() => setEditTarget(null)}
                categories={categories}
            />
            <ReorderDialog target={reorderTarget} onClose={() => setReorderTarget(null)} />
            <DeleteProductDialog
                target={deleteTarget}
                setInventory={setInventory}
                onClose={() => setDeleteTarget(null)}
            />
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
                <div className="bg-surface border-border absolute top-full left-0 z-99 mt-1.5 w-56 rounded-2xl border shadow-xl">
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


type EditProductDialogProps = {
    target: InventoryItem | null;
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    onClose: () => void;
    categories: string[];
};

const EditProductDialog = ({ target, setInventory, onClose, categories }: EditProductDialogProps) => {
    const [form, setForm] = useState<EditForm | null>(null);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    useEffect(() => {
        if (target) {
            setForm(itemToForm(target));
            setConfirmingDelete(false);
            setSaveError(null);
        }
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
                aisle: form.aisle,
                shelf: form.shelf,
            });
            setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            onClose();
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Failed to save.");
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!target) return;
        setDeleteLoading(true);
        setSaveError(null);
        try {
            await apiDeleteProduct(target.id);
            setInventory((prev) => prev.filter((i) => i.id !== target.id));
            onClose();
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Failed to delete.");
        } finally {
            setDeleteLoading(false);
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
                    <Select
                        label="Category"
                        value={form.category}
                        onChange={(e) => setField("category", e.target.value)}
                        options={categories.map((c) => ({ value: c, label: c }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Aisle" value={form.aisle} onChange={(e) => setField("aisle", e.target.value)} />
                        <CheckboxDropdown
                            label="Shelf"
                            options={SHELVES}
                            selected={form.shelf
                                .split(",")
                                .map((x: string) => x.trim())
                                .filter(Boolean)}
                            onChange={(next) => setField("shelf", next.join(", "))}
                            disabled={!!(target.locations && target.locations.length > 0)}
                            formatOption={(s) => `S${s}`}
                        />
                    </div>
                    {target.locations && target.locations.length > 0 && (
                        <CheckboxDropdown
                            label="Position"
                            options={POSITIONS}
                            selected={(target.locations ?? []).map((l) => String(l.position))}
                            onChange={() => {}}
                            disabled={true}
                            formatOption={(s) => `P${s}`}
                        />
                    )}
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
                    {confirmingDelete ? (
                        <div className="border-red/40 bg-red/5 mt-2 space-y-2 rounded-xl border p-3">
                            <p className="text-text text-xs font-semibold">
                                Delete {target.brand} {target.productName}? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(false)}
                                    disabled={deleteLoading}
                                    className="bg-surface-muted text-text-secondary flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition"
                                >
                                    Keep
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleteLoading}
                                    className="bg-red flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                                >
                                    {deleteLoading ? "Deleting…" : "Delete permanently"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmingDelete(true)}
                                disabled={saveLoading}
                                className="border-red/40 text-red hover:bg-red/10 rounded-xl border px-4 py-3 font-semibold transition"
                            >
                                Delete
                            </button>
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
                    )}
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

const DeleteProductDialog = ({
    target,
    setInventory,
    onClose,
}: {
    target: InventoryItem | null;
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    onClose: () => void;
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (target) setError(null);
    }, [target]);

    const handleDelete = async () => {
        if (!target) return;
        setLoading(true);
        setError(null);
        try {
            await apiDeleteProduct(target.id);
            setInventory((prev) => prev.filter((i) => i.id !== target.id));
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={!!target}
            title="Delete Product"
            description={
                target
                    ? `Delete ${target.brand} ${target.productName} (${target.variant} · ${target.size})? This cannot be undone.`
                    : ""
            }
            onClose={onClose}
        >
            {error && <p className="text-red mb-3 text-xs">{error}</p>}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="bg-surface-muted text-text-secondary flex-1 rounded-xl px-4 py-3 font-semibold transition"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-red flex-1 rounded-xl px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? "Deleting…" : "Delete permanently"}
                </button>
            </div>
        </Dialog>
    );
};

type AddProductDialogProps = {
    categories: string[];
    open: boolean;
    onClose: () => void;
    onCreated: (item: InventoryItem) => void;
};

type AddForm = {
    brand: string;
    productName: string;
    variant: string;
    size: string;
    category: string;
    stockCount: string;
    aisle: string;
    shelf: string;
    positions: string;
};

const emptyAddForm: AddForm = {
    brand: "",
    productName: "",
    variant: "",
    size: "",
    category: "",
    stockCount: "0",
    aisle: AISLES[0],
    shelf: "",
    positions: "",
};

const AddProductDialog = ({ categories, open, onClose, onCreated }: AddProductDialogProps) => {
    const [form, setForm] = useState<AddForm>(emptyAddForm);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm({ ...emptyAddForm, category: categories[0] ?? "" });
            setSaveError(null);
        }
    }, [open, categories]);

    const setField = (field: keyof AddForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        if (!form.productName.trim()) {
            setSaveError("Product name is required.");
            return;
        }
        const qty = Math.max(0, parseInt(form.stockCount, 10) || 0);
        setSaveLoading(true);
        setSaveError(null);
        try {
            const positions = form.positions
                .split(",")
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n));
            const created = await apiCreateProduct({
                name: form.productName.trim(),
                brand: form.brand.trim(),
                variant: form.variant.trim(),
                size: form.size.trim(),
                type: form.category.trim(),
                quantity_in_store: qty,
                aisle: form.aisle.trim(),
                shelf: form.shelf.trim(),
                positions,
            });
            onCreated(created);
            onClose();
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Failed to create product.");
        } finally {
            setSaveLoading(false);
        }
    };

    return (
        <Dialog open={open} title="Add Product" description="Create a new inventory item." onClose={onClose}>
            <div className="space-y-3">
                <Field label="Brand" value={form.brand} onChange={(e) => setField("brand", e.target.value)} required />
                <Field
                    label="Product Name"
                    value={form.productName}
                    onChange={(e) => setField("productName", e.target.value)}
                    required
                />
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Variant" value={form.variant} onChange={(e) => setField("variant", e.target.value)} />
                    <Field label="Size" value={form.size} onChange={(e) => setField("size", e.target.value)} />
                </div>
                <Select
                    label="Category"
                    value={form.category}
                    options={categories.map((c) => ({ value: c, label: c }))}
                    onChange={(e) => setField("category", e.target.value)}
                    required
                ></Select>
                <div className="grid grid-cols-2 gap-3">
                    <Select
                        label="Aisle"
                        required
                        value={form.aisle}
                        onChange={(e) => setField("aisle", e.target.value)}
                        options={AISLES.map((a) => ({ value: a, label: a }))}
                    />
                    <CheckboxDropdown
                        label="Shelf"
                        options={SHELVES}
                        selected={form.shelf
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)}
                        onChange={(next) => setField("shelf", next.join(", "))}
                        formatOption={(s) => `Shelf ${s}`}
                    />
                    <CheckboxDropdown
                        label="Position"
                        options={POSITIONS}
                        selected={form.positions
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)}
                        onChange={(next) => setField("positions", next.join(", "))}
                        formatOption={(s) => `Position ${s}`}
                    />
                </div>
                <Field
                    label="Stock Count"
                    type="number"
                    min={0}
                    value={form.stockCount}
                    onChange={(e) => setField("stockCount", e.target.value)}
                    required
                />
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
                        {saveLoading ? "Creating…" : "Create Product"}
                    </button>
                </div>
            </div>
        </Dialog>
    );
};

export default Inventory;
