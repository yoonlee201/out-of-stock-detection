import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { InventoryItem, InventoryStatus } from "../types/inventory";
import { QUANTITY_STATUS_LABEL, quantityStatusClass, SHELF_STATUS_LABEL, shelfStatusClass } from "../utils/constants";
import { ThreeVerticalDotsIcon } from "./Icons";

const MENU_WIDTH = 144; // Tailwind w-36

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
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Position the portaled menu relative to the trigger button. Done in a
    // layout effect so the position is set before paint — no flicker.
    useLayoutEffect(() => {
        if (!menuOpen) return;
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        // Right-align the menu's right edge to the button's right edge, like
        // the original `right-0` did inside the cell.
        const left = rect.right - MENU_WIDTH;
        const top = rect.bottom + 4;
        setMenuPos({ top, left });
    }, [menuOpen]);

    // Close on outside click — the menu lives in a portal, so we have to
    // exempt both the menu and the trigger button from "outside".
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
            setMenuOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [menuOpen]);

    // The portal uses fixed positioning relative to the viewport, so any
    // scroll or resize moves the trigger out from under the menu — close it.
    useEffect(() => {
        if (!menuOpen) return;
        const close = () => setMenuOpen(false);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
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
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${quantityStatusClass(status)}`}
                >
                    {QUANTITY_STATUS_LABEL[status]}
                </span>
            </td>
            <td className="px-5 py-4">
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${shelfStatusClass(item.shelfStatus)}`}
                >
                    {SHELF_STATUS_LABEL[item.shelfStatus]}
                </span>
            </td>
            <td className="text-text-muted px-5 py-4 text-xs">
                {item.lastChecked.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </td>
            <td className="px-5 py-4">
                <div className="flex justify-end">
                    <button
                        ref={buttonRef}
                        type="button"
                        onClick={() => setMenuOpen((o) => !o)}
                        className="text-text-muted hover:bg-surface-muted rounded-lg p-1.5 transition-colors"
                        aria-label="Row actions"
                    >
                        <ThreeVerticalDotsIcon />
                    </button>
                    {menuOpen &&
                        menuPos &&
                        createPortal(
                            <div
                                ref={menuRef}
                                style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
                                className="bg-surface border-border z-[100] rounded-2xl border shadow-xl"
                            >
                                <div className="space-y-0.5 p-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onEdit();
                                            setMenuOpen(false);
                                        }}
                                        className="hover:bg-surface-muted text-text-secondary w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onReorder();
                                            setMenuOpen(false);
                                        }}
                                        className="hover:bg-surface-muted text-text-secondary w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                    >
                                        Reorder
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDelete();
                                            setMenuOpen(false);
                                        }}
                                        className="text-red hover:bg-red/10 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>,
                            document.body,
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
            <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${quantityStatusClass(status)}`}
            >
                {QUANTITY_STATUS_LABEL[status]}
            </span>
        </td>
        <td className="text-text-muted px-5 py-4 text-xs">
            {item.lastChecked.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </td>
        <td className="px-5 py-4" />
    </tr>
);
