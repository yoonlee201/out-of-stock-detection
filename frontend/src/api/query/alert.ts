import { isAxiosError } from "axios";
import { axiosAuth } from "..";

export interface AlertHistoryItem {
    id: number;
    alert_type: string;
    sent_time: string;
    user: { user_id: number; first_name: string; last_name: string; email: string };
    product: { product_id: number; name: string; shelf: string; aisle: string };
}

export const apiGetAlertHistory = async (): Promise<AlertHistoryItem[]> => {
    try {
        const { data } = await axiosAuth.get("/alerts/history");
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.message || "Failed to fetch alert history.");
        }
        throw new Error("Failed to fetch alert history.");
    }
};

export const apiMakeOutOfStockAlert = async () => {
    try {
        const { data } = await axiosAuth.post("/alerts/send_out_of_stock");
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to send out of stock alert.";
            throw new Error(message);
        }
        throw new Error("Failed to send out of stock alert.");
    }
};
