import { isAxiosError } from "axios";
import { axiosAuth } from "..";

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
