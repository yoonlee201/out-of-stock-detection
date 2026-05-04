export type AlertType = "restock" | "shelf_detection";

export type AlertHistoryItem = {
    id: number;
    user_id: number;
    shelf_analysis_log_id: number | null;
    alert_type: AlertType;
    missing: number;
    misplaced: number;
    sent_time: string | null;
};
