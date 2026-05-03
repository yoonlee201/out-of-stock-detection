import { isAxiosError } from "axios";
import { axiosAuth } from "..";

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

const DIRECT_URL = import.meta.env.VITE_BACKEND_BASE_URL
    ? `${import.meta.env.VITE_BACKEND_BASE_URL}${import.meta.env.VITE_BACKEND_URL}`
    : import.meta.env.VITE_BACKEND_URL;

const resolveEndpoint = (path: string) =>
    DIRECT_URL ? `${DIRECT_URL}${path}` : path;

export interface JobSubmitResponse {
    job_id: string;
    queue_position: number | null;
}

export interface JobStatus {
    status: "queued" | "running" | "done" | "failed";
    progress: number;
    eta_seconds: number | null;
    queue_position: number | null;
    result: ShelfAnalysisResponse | null;
    error: string | null;
}

export const apiSubmitAnalysis = async (
    image: File,
    onUploadProgress?: (percent: number) => void,
): Promise<JobSubmitResponse> => {
    const formData = new FormData();
    formData.append("image", image);

    try {
        const { data } = await axiosAuth.post<JobSubmitResponse>(
            resolveEndpoint("/shelf-analysis/analyze"),
            formData,
            {
                timeout: 120000,
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: onUploadProgress
                    ? (event) => {
                          if (event.total) {
                              onUploadProgress(Math.round((event.loaded / event.total) * 100));
                          }
                      }
                    : undefined,
            },
        );
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            if (!error.response) {
                throw new Error(
                    "Could not reach the shelf analysis server. Make sure the backend is running.",
                );
            }
            const msg =
                (error.response.data as { message?: string })?.message ||
                `Submission failed with status ${error.response.status}.`;
            throw new Error(msg);
        }
        throw new Error("An unexpected error occurred while submitting the image.");
    }
};

export const apiGetJobStatus = async (jobId: string): Promise<JobStatus> => {
    try {
        const { data } = await axiosAuth.get<JobStatus>(resolveEndpoint(`/shelf-analysis/job/${jobId}`));
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const msg =
                (error.response?.data as { message?: string })?.message ||
                `Failed to get job status (${error.response?.status ?? "network error"}).`;
            throw new Error(msg);
        }
        throw new Error("Failed to get job status.");
    }
};

export interface AnalysisHistoryEntry {
    id: number;
    file_name: string;
    created_at: string;
    result: ShelfAnalysisResponse;
}

export const apiGetAnalysisHistory = async (): Promise<AnalysisHistoryEntry[]> => {
    try {
        const { data } = await axiosAuth.get<AnalysisHistoryEntry[]>("/shelf-analysis");
        return data;
    } catch (error) {
        if (isAxiosError(error)) {
            throw new Error(error.response?.data?.message || "Failed to load analysis history.");
        }
        throw new Error("Failed to load analysis history.");
    }
};
