import { useState, useRef, useEffect } from "react";
import type { InventoryItem, InventoryStatus } from "../types/inventory";
import {
    QUANTITY_STATUS_LABEL,
    quantityStatusClass,
    SHELF_STATUS_LABEL,
    shelfStatusClass,
} from "../utils/constants";

export const EmployeeRow = ({
    item,
    status,
    onEdit,
    onReorder,
    onDelete,
}: {
    item: InventoryItem;
    status: InventoryStatus;
    onEdit: () => void;
    onReorder: () => void;
    onDelete: () => void;
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [menuOpen]);

    return (
        <tr className="border-border hover:bg-surface-muted border-b transition-colors">
            <td className="px-5 py-4">
                <p className="text-text font-semibold">
                    {item.brand} {item.productName}
                </p>
                <p className="text-text-muted mt-0.5 text-xs">
                    {item.variant} · {item.size}
                </p>
            </td>
            <td className="text-text-muted px-5 py-4 text-xs font-medium">{item.category}</td>
            <td className="text-text-secondary px-5 py-4 text-xs">{item.aisle || "—"}</td>
            <td className="text-text-secondary px-5 py-4 text-xs">{item.shelf || "—"}</td>
            <td className="text-text-secondary px-5 py-4 text-sm font-semibold">{item.stockCount}</td>
            <td className="px-5 py-4">
                <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${quantityStatusClass(status)}`}>
                    {QUANTITY_STATUS_LABEL[status]}
                </span>
            </td>
            <td className="px-5 py-4">
                <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${shelfStatusClass(item.shelfStatus)}`}>
                    {SHELF_STATUS_LABEL[item.shelfStatus]}
                </span>
            </td>
            <td className="text-text-muted px-5 py-4 text-xs">
                {item.lastChecked.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </td>
            <td className="px-5 py-4">
                <div ref={menuRef} className="relative flex justify-end">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((o) => !o)}
                        className="text-text-muted hover:bg-surface-muted rounded-lg p-1.5 transition-colors"
                        aria-label="Row actions"
                    >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                        </svg>
                    </button>
                    {menuOpen && (
                        <div className="bg-surface border-border absolute right-0 top-full z-20 mt-1 w-36 rounded-2xl border shadow-xl">
                            <div className="space-y-0.5 p-1.5">
                                <button
                                    type="button"
                                    onClick={() => { onEdit(); setMenuOpen(false); }}
                                    className="hover:bg-surface-muted text-text-secondary w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onReorder(); setMenuOpen(false); }}
                                    className="hover:bg-surface-muted text-text-secondary w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                >
                                    Reorder
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onDelete(); setMenuOpen(false); }}
                                    className="text-red hover:bg-red/10 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
};

export const CustomerRow = ({ item, status }: { item: InventoryItem; status: InventoryStatus }) => (
    <tr className="border-border hover:bg-surface-muted border-b transition-colors">
        <td className="px-5 py-4">
            <p className="text-text font-semibold">
                {item.brand} {item.productName}
            </p>
            <p className="text-text-muted mt-0.5 text-xs">
                {item.variant} · {item.size}
            </p>
        </td>
        <td className="text-text-muted px-5 py-4 text-xs font-medium">{item.category}</td>
        <td className="text-text-secondary px-5 py-4 text-xs">{item.aisle || "—"}</td>
        <td className="text-text-secondary px-5 py-4 text-xs">{item.shelf || "—"}</td>
        <td className="text-text-secondary px-5 py-4 text-sm font-semibold">{item.stockCount}</td>
        <td className="px-5 py-4">
            <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${quantityStatusClass(status)}`}>
                {QUANTITY_STATUS_LABEL[status]}
            </span>
        </td>
        <td className="text-text-muted px-5 py-4 text-xs">
            {item.lastChecked.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </td>
        <td className="px-5 py-4" />
    </tr>
);
