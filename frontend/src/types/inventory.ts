export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

/** Whether the product is physically present on the shelf. Set by shelf detection (Dashboard). */
export type ShelfStatus = "on_shelf" | "missing" | "misplaced";

export interface InventoryItem {
    id: string;
    brand: string;
    productName: string;
    variant: string;
    size: string;
    category: string;
    /** Total units in the store. */
    stockCount: number;
    /** Baseline (planogram) capacity. Used as the denominator for stock-status %. */
    originalStock: number;
    /** Physical location on the shop floor. */
    aisle: string;
    shelf: string;
    /** Set by shelf detection — read-only in Inventory. */
    shelfStatus: ShelfStatus;
    lastChecked: Date;
}

export type CustomerAvailability = "available" | "limited" | "unavailable";
