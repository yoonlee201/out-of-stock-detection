import { isAxiosError } from "axios";
import { axiosAuth } from "..";
import logger from "../../utils/log";

export interface ShelfSkuDetails {
    brand: string;
    product_name: string;
    variant: string;
    size: string;
    confidence: number;
    visibility?: "full" | "partial" | "side_only" | string;
}

export interface ShelfDetection {
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
}

export interface ShelfAnalysisResponse {
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
}

export interface ShelfAnalysisJob {
    job_id: string;
    status: "queued" | "processing" | "completed" | "failed" | string;
    original_filename?: string | null;
    error_message?: string | null;
    worker_id?: string | null;
    created_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    result?: ShelfAnalysisResponse | null;
}

type PollOptions = {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onUpdate?: (job: ShelfAnalysisJob) => void;
};

const getAxiosErrorMessage = (error: unknown, fallback: string) => {
    if (!isAxiosError(error)) {
        return fallback;
    }

    const responseData = error.response?.data;
    const backendMessage =
        typeof responseData === "object" && responseData !== null
            ? (responseData as { message?: string }).message
            : undefined;

    return backendMessage || fallback;
};

export const apiAnalyzeShelf = async (image: File): Promise<ShelfAnalysisResponse> => {
    const job = await apiCreateShelfAnalysisJob(image);
    return await apiWaitForShelfAnalysisJob(job.job_id);
};

export const apiCreateShelfAnalysisJob = async (image: File): Promise<ShelfAnalysisJob> => {
    const formData = new FormData();
    formData.append("image", image);

    try {
        const { data } = await axiosAuth.post<{ message: string; job: ShelfAnalysisJob }>("/shelf-analysis/jobs", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
            timeout: 60_000,
        });

        return data.job;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            if (!error.response) {
                throw new Error(
                    "Could not reach the shelf analysis server. Make sure the ARC backend is still running and your SSH tunnel to port 8000 is still open."
                );
            }

            const message = getAxiosErrorMessage(
                error,
                `Could not create shelf analysis job. Status ${error.response.status}.`,
            );
            logger.error("Shelf analysis job creation error:", message);
            throw new Error(message);
        }

        logger.error("Unexpected shelf analysis error:", error);
        throw new Error("An unexpected error occurred while creating the shelf analysis job.");
    }
};

export const apiGetShelfAnalysisJob = async (jobId: string): Promise<ShelfAnalysisJob> => {
    try {
        const { data } = await axiosAuth.get<{ job: ShelfAnalysisJob }>(`/shelf-analysis/jobs/${jobId}`, {
            timeout: 30_000,
        });
        return data.job;
    } catch (error: unknown) {
        const message = getAxiosErrorMessage(error, "Failed to fetch shelf analysis job status.");
        logger.error("Shelf analysis job polling error:", message);
        throw new Error(message);
    }
};

export const apiWaitForShelfAnalysisJob = async (
    jobId: string,
    { timeoutMs = 30 * 60 * 1000, pollIntervalMs = 3_000, onUpdate }: PollOptions = {},
): Promise<ShelfAnalysisResponse> => {
    const startedAt = Date.now();

    while (true) {
        const job = await apiGetShelfAnalysisJob(jobId);
        onUpdate?.(job);

        if (job.status === "completed") {
            if (job.result) {
                return job.result;
            }
            throw new Error("Shelf analysis job completed without a result payload.");
        }

        if (job.status === "failed") {
            throw new Error(job.error_message || "Shelf analysis job failed.");
        }

        if (Date.now() - startedAt >= timeoutMs) {
            throw new Error("Shelf analysis job timed out before completion.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
    }
};
