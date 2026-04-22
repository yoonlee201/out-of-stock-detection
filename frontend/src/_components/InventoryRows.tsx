import type { CustomerAvailability, InventoryItem, InventoryStatus } from "../types/inventory";
import {
    CUSTOMER_AVAILABILITY_LABEL,
    customerAvailabilityClass,
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
}: {
    item: InventoryItem;
    status: InventoryStatus;
    onEdit: () => void;
    onReorder: () => void;
}) => (
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
        <td className="text-text-secondary px-5 py-4 text-sm font-semibold">{item.stockCount}</td>
        <td className="px-5 py-4">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quantityStatusClass(status)}`}>
                {QUANTITY_STATUS_LABEL[status]}
            </span>
        </td>
        <td className="px-5 py-4">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${shelfStatusClass(item.shelfStatus)}`}>
                {SHELF_STATUS_LABEL[item.shelfStatus]}
            </span>
        </td>
        <td className="text-text-muted px-5 py-4 text-xs">
            {item.lastChecked.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </td>
        <td className="flex items-center gap-2 px-5 py-4">
            <button
                type="button"
                onClick={onEdit}
                className="border-border text-text-secondary hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
            >
                Edit
            </button>
            <button
                type="button"
                onClick={onReorder}
                className="border-border text-text-secondary hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
            >
                Reorder
            </button>
        </td>
    </tr>
);

export const CustomerRow = ({ item, availability }: { item: InventoryItem; availability: CustomerAvailability }) => (
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
        <td className="text-text-secondary px-5 py-4 text-sm font-semibold">{item.stockCount}</td>
        <td className="px-5 py-4">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${customerAvailabilityClass(availability)}`}>
                {CUSTOMER_AVAILABILITY_LABEL[availability]}
            </span>
        </td>
        <td className="text-text-muted px-5 py-4 text-xs">
            {item.lastChecked.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </td>
        <td className="px-5 py-4">
            {(item.shelfStatus === "missing" || item.shelfStatus === "misplaced") && item.stockCount > 0 && (
                <p className="text-text-muted text-xs">In store — not on shelf yet</p>
            )}
        </td>
    </tr>
);
