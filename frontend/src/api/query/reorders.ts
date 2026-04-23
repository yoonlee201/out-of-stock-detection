import { isAxiosError } from "axios";
import { axiosAuth } from "..";

export interface ReorderResult {
    id: number;
    product_id: number;
    quantity: number;
    created_at: string;
}

export const apiCreateReorder = async (productId: string, quantity: number): Promise<ReorderResult> => {
    try {
        const { data } = await axiosAuth.post<{ reorder: ReorderResult }>("/reorders/", {
            product_id: Number(productId),
            quantity,
        });
        return data.reorder;
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error || "Failed to create reorder.");
        }
        throw new Error("Failed to create reorder.");
    }
};
