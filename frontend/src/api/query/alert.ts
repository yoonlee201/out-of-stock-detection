import { isAxiosError } from "axios";
import { axiosAuth } from "..";
import type { AlertHistoryItem } from "../../types/alerts";

export const apiGetAlertHistory = async (): Promise<AlertHistoryItem[]> => {
    try {
        const { data } = await axiosAuth.get<AlertHistoryItem[]>("/alerts");
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to load alert history.";
            throw new Error(message);
        }
        throw new Error("Failed to load alert history.");
    }
};
