import type { MissingSkuItem, PlanogramAnalysisResponse } from "../api/query/spaceDetection";

const STORAGE_KEY = "latest_planogram_audit_summary";

export interface StoredMissingItem {
    slot_id: string;
    expected_sku: string;
    expected_display_name: string;
    observed_sku: string | null;
    observed_display_name: string | null;
    reason: string;
}

export interface StoredPlanogramAuditSummary {
    planogram_id: string;
    updated_at: string;
    missing_items: StoredMissingItem[];
}

export const saveLatestPlanogramAuditSummary = (result: PlanogramAnalysisResponse) => {
    if (typeof window === "undefined") {
        return;
    }

    const summary: StoredPlanogramAuditSummary = {
        planogram_id: result.planogram_id,
        updated_at: new Date().toISOString(),
        missing_items: result.missing_items.map((item: MissingSkuItem) => ({
            slot_id: item.slot_id,
            expected_sku: item.expected_sku,
            expected_display_name: item.expected_display_name,
            observed_sku: item.observed_sku,
            observed_display_name: item.observed_display_name,
            reason: item.reason,
        })),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
};

export const loadLatestPlanogramAuditSummary = (): StoredPlanogramAuditSummary | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as StoredPlanogramAuditSummary;
    } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
    }
};
