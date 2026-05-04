export type ShelfSkuDetails = {
    brand: string;
    product_name: string;
    variant: string;
    size: string;
    confidence: number;
    visibility?: "full" | "partial" | "side_only" | string;
};

export type ShelfDetection = {
    bbox: [number, number, number, number];
    type: "product" | "empty_space";
    sku: ShelfSkuDetails | null;
    expected_sku?: ShelfSkuDetails | null;
    match_score?: number;
    audit_status?: "correct" | "missing" | "misplaced" | "unverified" | string;
    issue_marker?: string | null;
    slot_id?: string;
    row?: number;
    position?: number;
    detection_quality?: "merged_box" | string | null;
    assignment_method?: "position" | "content" | "boundary_resolved" | string | null;
    tall_box?: boolean;
    size_class?: "tall" | "normal" | "small" | string;
};

export type ShelfAnalysisResponse = {
    message: string;
    summary: {
        product_count: number;
        empty_space_count: number;
        unique_sku_count: number;
        correct_count?: number;
        missing_count?: number;
        misplaced_count?: number;
        unverified_count?: number;
    };
    compliance_report?: {
        visible_rows: number[];
        not_visible_rows: number[];
        visibility_note: string;
        visible_slot_count: number;
        correct_slot_count: number;
        compliance_score: number;
        total_planogram_rows: number;
    };
    detections: ShelfDetection[];
    compliance_notes?: string[];
    annotated_image: string;
};

export type JobSubmitResponse = {
    job_id: string;
    queue_position: number | null;
};

export type JobStatus = {
    status: "queued" | "running" | "done" | "failed";
    progress: number;
    eta_seconds: number | null;
    queue_position: number | null;
    result: ShelfAnalysisResponse | null;
    error: string | null;
};

export type ActiveJobInfo = {
    job_id: string;
    file_name: string;
    status: "queued" | "running";
    progress: number;
    eta_seconds: number | null;
    queue_position: number | null;
    submitted_at: number;
};

export type AnalysisHistoryEntry = {
    id: number;
    file_name: string;
    created_at: string;
    missing_count: number;
    misplaced_count: number;
    compliance_score?: number | null;
};
