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
        const { data } = await axiosAuth.post<{ reorder: ReorderResult }>(
            "/reorders/",
            {
                product_id: Number(productId),
                quantity,
            },
            {
                withCredentials: true,
            },
        );
        return data.reorder;
    } catch (error) {
        if (isAxiosError(error)) {
            console.log("Reorder error response:", error.response?.status, error.response?.data);
            throw new Error(error.response?.data?.error || error.response?.data?.message || "Failed to create reorder.");
        }
        throw new Error("Failed to create reorder.");
    }
};

export const apiGetReorders = async (): Promise<ReorderResult[]> => {
    try {
        const { data } = await axiosAuth.get<ReorderResult[]>("/reorders/");
        return data;
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error || "Failed to load reorders.");
        }
        throw new Error("Failed to load reorders.");
    }
};