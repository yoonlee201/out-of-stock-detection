import type { EmployeeStatus, UserRole } from "../types/db";
import type { CustomerAvailability, InventoryItem, InventoryStatus, ShelfStatus } from "../types/inventory";

export const STATUS_STYLES: Record<EmployeeStatus, string> = {
    active: "bg-green/10 text-green",
    inactive: "bg-gray-100 text-gray-400",
    pending: "bg-yellow/10 text-yellow",
};

export const ROLE_STYLES: Record<UserRole, string> = {
    associate: "bg-blue/10 text-blue",
    supervisor: "bg-secondary/10 text-secondary",
    manager: "bg-primary/10 text-primary",
    customer: "bg-red/10 text-red",
};

export const EMPLOYEE_ROLES: UserRole[] = ["associate", "supervisor", "manager"];
export const STATUSES: EmployeeStatus[] = ["active", "inactive", "pending"];

export const STATUS_TEXT: Record<EmployeeStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    pending: "Pending",
};

export const STATUS_DOT: Record<EmployeeStatus, string> = {
    active: "bg-green-500",
    inactive: "bg-gray-300",
    pending: "bg-yellow-400",
};

// ── Quantity status ────────────────────────────────────────────────────────────
// Percentage of original (planogram) capacity. Keep aligned with the backend
// thresholds in backend/app/services/alert_services.py.
export const OUT_OF_STOCK_RATIO = 0.05;
export const LOW_STOCK_RATIO = 0.15;

export const deriveStatus = (qty: number, original?: number): InventoryStatus => {
    const baseline = original && original > 0 ? original : qty || 1;
    const ratio = qty / baseline;
    if (ratio < OUT_OF_STOCK_RATIO) return "out_of_stock";
    if (ratio < LOW_STOCK_RATIO) return "low_stock";
    return "in_stock";
};

export const QUANTITY_STATUS_LABEL: Record<InventoryStatus, string> = {
    in_stock: "In Stock",
    low_stock: "Low Stock",
    out_of_stock: "Out of Stock",
};

export const quantityStatusClass = (status: InventoryStatus): string => {
    switch (status) {
        case "in_stock":
            return "border border-status-success-text text-status-success-text";
        case "low_stock":
            return "border border-status-misplaced-text text-status-misplaced-text";
        case "out_of_stock":
            return "border border-status-missing-text text-status-missing-text";
    }
};

// ── Shelf status ───────────────────────────────────────────────────────────────
export const SHELF_STATUS_LABEL: Record<ShelfStatus, string> = {
    on_shelf: "On Shelf",
    missing: "Missing",
    misplaced: "Misplaced",
    low_stock: "Low Stock",
    out_of_stock: "Out of Stock",
    unknown: "Unknown",
};

export const shelfStatusClass = (status: ShelfStatus): string => {
    switch (status) {
        case "on_shelf":
            return "bg-status-success-bg text-status-success-text";
        case "low_stock":
            return "border border-status-misplaced-text text-status-misplaced-text";
        case "out_of_stock":
            return "border border-status-missing-text text-status-missing-text";
        case "unknown":
            return "bg-surface-muted text-text-muted";
        case "missing":
            return "bg-status-missing-bg text-status-missing-text";
        case "misplaced":
            return "bg-status-misplaced-bg text-status-misplaced-text";
    }
};

// ── Customer availability ──────────────────────────────────────────────────────
// Only reflects quantity — shelf placement is shown separately as a plain note.

export const deriveCustomerAvailability = (item: InventoryItem): CustomerAvailability => {
    const status = deriveStatus(item.stockCount, item.originalStock);
    if (status === "out_of_stock") return "unavailable";
    if (status === "low_stock") return "limited";
    return "available";
};

export const CUSTOMER_AVAILABILITY_LABEL: Record<CustomerAvailability, string> = {
    available: "Available",
    limited: "Limited Stock",
    unavailable: "Out of Stock",
};

export const customerAvailabilityClass = (status: CustomerAvailability): string => {
    switch (status) {
        case "available":
            return "bg-status-success-bg text-status-success-text";
        case "limited":
            return "bg-status-misplaced-bg text-status-misplaced-text";
        case "unavailable":
            return "bg-status-missing-bg text-status-missing-text";
    }
};

export const QUANTITY_STATUS_FILTERS: Array<{ value: InventoryStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "in_stock", label: "In Stock" },
    { value: "low_stock", label: "Low Stock" },
    { value: "out_of_stock", label: "Out of Stock" },
];
