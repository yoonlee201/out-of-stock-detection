export type ReorderProductSummary = {
    name: string;
    brand: string;
    variant: string;
    size: string;
    type: string;
    shelf: string;
    aisle: string;
};

export type ReorderResult = {
    id: number;
    product_id: number;
    quantity: number;
    created_at: string;
    // null if the underlying product was deleted after the reorder was placed.
    product: ReorderProductSummary | null;
};
