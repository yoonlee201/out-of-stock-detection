import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { InventoryItem, InventoryStatus, ProductLocation } from "../types/inventory";
import { QUANTITY_STATUS_LABEL, quantityStatusClass, SHELF_STATUS_LABEL, shelfStatusClass } from "../utils/constants";
import { ThreeVerticalDotsIcon } from "./Icons";

const MENU_WIDTH = 144; // Tailwind w-36
const SUB_MENU_WIDTH = 200;

const groupLocationsByShelf = (locations: ProductLocation[]): [string, ProductLocation[]][] => {
    const map = new Map<string, ProductLocation[]>();
    for (const loc of locations) {
        const list = map.get(loc.shelf) ?? [];
        list.push(loc);
        map.set(loc.shelf, list);
    }
    return Array.from(map.entries())
        .map(([shelf, locs]) => [shelf, locs.sort((a, b) => a.position - b.position)] as [string, ProductLocation[]])
        .sort(([a], [b]) => (Number(a) || 0) - (Number(b) || 0));
};

const ShelfCell = ({ item }: { item: InventoryItem }) => {
    if (!item.locations || item.locations.length === 0) {
        return <span>{item.shelf || "—"}</span>;
    }
    const shelves = Array.from(new Set(item.locations.map((l) => l.shelf))).sort(
        (a, b) => (Number(a) || 0) - (Number(b) || 0),
    );
    return <span>{shelves.join(", ")}</span>;
};

const PositionCell = ({ item }: { item: InventoryItem }) => {
    if (!item.locations || item.locations.length === 0) return <span className="text-text-muted">—</span>;
    return (
        <div className="space-y-0.5">
            {groupLocationsByShelf(item.locations).map(([shelf, locs]) => (
                <div key={shelf} className="flex flex-wrap items-baseline gap-1">
                    <span className="text-text-muted text-[10px]">S{shelf}:</span>
                    <span className="text-text-secondary">{locs.map((l) => `P${l.position}`).join(", ")}</span>
                </div>
            ))}
        </div>
    );
};

const ShelfStatusCell = ({ item }: { item: InventoryItem }) => {
    if (!item.locations || item.locations.length === 0) {
        return (
            <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${shelfStatusClass(item.shelfStatus)}`}
            >
                {SHELF_STATUS_LABEL[item.shelfStatus] ?? item.shelfStatus}
            </span>
        );
    }
    return (
        <div className="space-y-1">
            {groupLocationsByShelf(item.locations).map(([shelf, locs]) => (
                <div key={shelf} className="flex flex-wrap items-center gap-1">
                    <span className="text-text-muted text-xs">S{shelf}:</span>
                    {locs.map((loc) => (
                        <span
                            key={loc.slotId}
                            title={`${loc.slotId} — ${SHELF_STATUS_LABEL[loc.shelfStatus] ?? loc.shelfStatus}`}
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${shelfStatusClass(loc.shelfStatus)}`}
                        >
                            P{loc.position} · {SHELF_STATUS_LABEL[loc.shelfStatus] ?? loc.shelfStatus}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
};

export const EmployeeRow = ({
    item,
    status,
    onEdit,
    onReorder,
    onDelete,
    onEditLocation,
    onAddLocation,
}: {
    item: InventoryItem;
    status: InventoryStatus;
    onEdit: () => void;
    onReorder: () => void;
    onDelete: () => void;
    onEditLocation?: (slotId: string) => void;
    onAddLocation?: (shelf: string, position: number) => void;
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [subMenu, setSubMenu] = useState<"edit" | "add" | null>(null);
    const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
    const [newShelf, setNewShelf] = useState("");
    const [newPosition, setNewPosition] = useState("");
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const activeWidth = subMenu ? SUB_MENU_WIDTH : MENU_WIDTH;

    useLayoutEffect(() => {
        if (!menuOpen) return;
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        const left = rect.right - activeWidth;
        const top = rect.bottom + 4;
        setMenuPos({ top, left });
    }, [menuOpen, subMenu, activeWidth]);

    useEffect(() => {
        if (!menuOpen) {
            setSubMenu(null);
            setSelectedSlotIds(new Set());
            setNewShelf("");
            setNewPosition("");
        }
    }, [menuOpen]);

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

    const locations = item.locations ?? [];

    const toggleSlot = (slotId: string) => {
        setSelectedSlotIds((prev) => {
            const next = new Set(prev);
            if (next.has(slotId)) { next.delete(slotId); } else { next.add(slotId); }
            return next;
        });
    };

    const handleConfirmEdit = () => {
        if (onEditLocation && selectedSlotIds.size > 0) {
            selectedSlotIds.forEach((slotId) => onEditLocation(slotId));
        } else {
            onEdit();
        }
        setMenuOpen(false);
    };

    const handleConfirmAdd = () => {
        const pos = parseInt(newPosition, 10);
        if (newShelf && !isNaN(pos) && onAddLocation) onAddLocation(newShelf, pos);
        setMenuOpen(false);
    };

    const renderMenuContent = () => {
        if (subMenu === "edit") {
            return (
                <div className="p-2 space-y-1.5">
                    <div className="flex items-center gap-2 pb-1 border-b border-border">
                        <button
                            type="button"
                            onClick={() => setSubMenu(null)}
                            className="text-text-muted hover:text-text text-xs font-semibold"
                        >
                            ←
                        </button>
                        <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">
                            Edit Location
                        </span>
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {locations.length > 0 ? (
                            locations.map((loc) => (
                                <label
                                    key={loc.slotId}
                                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-muted cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSlotIds.has(loc.slotId)}
                                        onChange={() => toggleSlot(loc.slotId)}
                                        className="accent-primary"
                                    />
                                    <span className="text-xs text-text-secondary font-medium">
                                        Shelf {loc.shelf} · Pos {loc.position}
                                    </span>
                                </label>
                            ))
                        ) : (
                            <p className="text-text-muted text-xs px-2 py-1">No locations assigned.</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleConfirmEdit}
                        disabled={locations.length > 0 && selectedSlotIds.size === 0}
                        className="w-full rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition"
                    >
                        Edit Selected
                    </button>
                </div>
            );
        }

        if (subMenu === "add") {
            return (
                <div className="p-2 space-y-2">
                    <div className="flex items-center gap-2 pb-1 border-b border-border">
                        <button
                            type="button"
                            onClick={() => setSubMenu(null)}
                            className="text-text-muted hover:text-text text-xs font-semibold"
                        >
                            ←
                        </button>
                        <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">
                            Add Location
                        </span>
                    </div>
                    <label className="flex flex-col gap-1 px-1">
                        <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Shelf</span>
                        <input
                            type="text"
                            value={newShelf}
                            onChange={(e) => setNewShelf(e.target.value)}
                            placeholder="e.g. 1"
                            className="bg-surface-muted border-border rounded-lg border px-2 py-1 text-xs text-text-secondary focus:outline-none"
                        />
                    </label>
                    <label className="flex flex-col gap-1 px-1">
                        <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Position</span>
                        <input
                            type="number"
                            value={newPosition}
                            onChange={(e) => setNewPosition(e.target.value)}
                            placeholder="e.g. 3"
                            min={1}
                            className="bg-surface-muted border-border rounded-lg border px-2 py-1 text-xs text-text-secondary focus:outline-none"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={handleConfirmAdd}
                        disabled={!newShelf || !newPosition}
                        className="w-full rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition"
                    >
                        Add
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-0.5 p-1.5">
                <button
                    type="button"
                    onClick={() => setSubMenu("edit")}
                    className="hover:bg-surface-muted text-text-secondary w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                >
                    Edit
                </button>
                <button
                    type="button"
                    onClick={() => setSubMenu("add")}
                    className="hover:bg-surface-muted text-text-secondary w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition"
                >
                    Add Location
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
        );
    };

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
            <td className="text-text-secondary px-5 py-4 text-xs">
                <ShelfCell item={item} />
            </td>
            <td className="text-text-secondary px-5 py-4 text-xs">
                <PositionCell item={item} />
            </td>
            <td className="text-text-secondary px-5 py-4 text-sm font-semibold">{item.stockCount}</td>
            <td className="px-5 py-4">
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${quantityStatusClass(status)}`}
                >
                    {QUANTITY_STATUS_LABEL[status]}
                </span>
            </td>
            <td className="px-5 py-4">
                <ShelfStatusCell item={item} />
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
                                style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: activeWidth }}
                                className="bg-surface border-border z-100 rounded-2xl border shadow-xl"
                            >
                                {renderMenuContent()}
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
        <td className="text-text-secondary px-5 py-4 text-xs">
            <ShelfCell item={item} />
        </td>
        <td className="text-text-secondary px-5 py-4 text-xs">
            <PositionCell item={item} />
        </td>
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
