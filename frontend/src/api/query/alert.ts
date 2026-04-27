import { isAxiosError } from "axios";
import { axiosAuth } from "..";

export type AlertType = "restock" | "shelf_detection";

export interface AlertHistoryItem {
    id: number;
    user_id: number;
    shelf_analysis_log_id: number | null;
    alert_type: AlertType;
    missing: number;
    misplaced: number;
    sent_time: string | null;
}

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