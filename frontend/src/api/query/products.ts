import { isAxiosError } from "axios";
import { axiosAuth } from "..";
import type { InventoryItem, ShelfStatus } from "../../types/inventory";

interface RawProduct {
    product_id: number;
    name: string;
    brand: string;
    variant: string;
    size: string;
    type: string;
    quantity_in_store: number;
    original_quantity?: number;
    aisle: string;
    shelf: string;
    shelf_status: string;
    last_checked: string | null;
}

const toInventoryItem = (p: RawProduct): InventoryItem => ({
    id: String(p.product_id),
    productName: p.name,
    brand: p.brand,
    variant: p.variant,
    size: p.size,
    category: p.type,
    stockCount: p.quantity_in_store,
    originalStock: p.original_quantity ?? p.quantity_in_store,
    aisle: p.aisle,
    shelf: p.shelf,
    shelfStatus: (p.shelf_status as ShelfStatus) || "unknown",
    lastChecked: p.last_checked ? new Date(p.last_checked) : new Date(0),
});

export const apiGetProducts = async (search?: string): Promise<InventoryItem[]> => {
    try {
        const params = search ? { search } : {};
        const { data } = await axiosAuth.get<RawProduct[]>("/products/", { params });
        return data.map(toInventoryItem);
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error || "Failed to load products.");
        }
        throw new Error("Failed to load products.");
    }
};

export const apiCreateProduct = async (product: {
    name: string;
    brand?: string;
    variant?: string;
    size?: string;
    type: string;
    quantity_in_store: number;
    aisle?: string;
    shelf?: string;
}): Promise<InventoryItem> => {
    try {
        const { data } = await axiosAuth.post<{ product: RawProduct }>("/products/", product);
        return toInventoryItem(data.product);
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error || "Failed to create product.");
        }
        throw new Error("Failed to create product.");
    }
};

export const apiDeleteProduct = async (id: string): Promise<void> => {
    try {
        await axiosAuth.delete(`/products/${id}`);
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error || "Failed to delete product.");
        }
        throw new Error("Failed to delete product.");
    }
};

export const apiUpdateProduct = async (
    id: string,
    updates: Partial<{
        name: string;
        brand: string;
        variant: string;
        size: string;
        type: string;
        quantity_in_store: number;
        aisle: string;
        shelf: string;
    }>,
): Promise<InventoryItem> => {
    try {
        const { data } = await axiosAuth.patch<{ product: RawProduct }>(`/products/${id}`, updates);
        return toInventoryItem(data.product);
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error || "Failed to update product.");
        }
        throw new Error("Failed to update product.");
    }
};
