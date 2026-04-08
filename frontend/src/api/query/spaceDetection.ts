import { isAxiosError } from "axios";
import { axiosAuth } from "..";
import logger from "../../utils/log";

export interface SpaceDetectionBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
    area: number;
}

export interface SpaceDetectionItem {
    label: string;
    confidence: number;
    bbox: SpaceDetectionBox;
}

export interface SpaceDetectionResponse {
    message: string;
    model: string;
    confidence_threshold: number;
    image: {
        width: number;
        height: number;
    };
    summary: {
        empty_space_count: number;
        estimated_empty_area_pixels: number;
        estimated_empty_area_percent: number;
    };
    detections: SpaceDetectionItem[];
    annotated_image: string;
}

export interface PlanogramMatch {
    sku_id: string;
    display_name: string;
    score: number;
}

export interface PlanogramSlotResult {
    slot_id: string;
    shelf_id: string;
    bbox: SpaceDetectionBox;
    expected_sku: string;
    expected_display_name: string;
    expected_reference_image: string;
    detected_sku: string | null;
    detected_display_name: string | null;
    status: "present" | "empty" | "unexpected_sku" | "uncertain";
    confidence: number;
    expected_match_score: number;
    match_margin: number;
    occupancy_score: number;
    observed_slot_image: string;
    top_matches: PlanogramMatch[];
}

export interface MissingSkuItem {
    slot_id: string;
    expected_sku: string;
    expected_display_name: string;
    observed_sku: string | null;
    observed_display_name: string | null;
    reason: string;
    reference_image: string;
    observed_slot_image: string;
}

export interface DetectedSkuSummary {
    sku_id: string;
    display_name: string;
    count: number;
}

export interface PlanogramAnalysisResponse {
    message: string;
    planogram_id: string;
    image: {
        width: number;
        height: number;
    };
    summary: {
        slot_count: number;
        correct_sku_count: number;
        empty_slot_count: number;
        missing_sku_count: number;
        unexpected_sku_count: number;
        uncertain_slot_count: number;
    };
    detected_skus: DetectedSkuSummary[];
    missing_items: MissingSkuItem[];
    slots: PlanogramSlotResult[];
    annotated_image: string;
    notes: string;
}

export const apiDetectSpaces = async ({
    image,
    conf,
}: {
    image: File;
    conf?: number;
}): Promise<SpaceDetectionResponse> => {
    const formData = new FormData();
    formData.append("image", image);

    if (typeof conf === "number") {
        formData.append("conf", conf.toString());
    }

    try {
        const { data } = await axiosAuth.post<SpaceDetectionResponse>("/space-detection/detect", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
            timeout: 120000,
        });

        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
            const message = backendMessage || "Space detection failed. Please try again.";
            logger.error("Space detection error:", message);
            throw new Error(message);
        }

        logger.error("Unexpected space detection error:", error);
        throw new Error("An unexpected error occurred while detecting space.");
    }
};

export const apiAnalyzePlanogram = async ({
    image,
    sceneId,
    datasetRoot,
}: {
    image: File;
    sceneId: string;
    datasetRoot?: string;
}): Promise<PlanogramAnalysisResponse> => {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("scene_id", sceneId);

    if (datasetRoot?.trim()) {
        formData.append("dataset_root", datasetRoot.trim());
    }

    try {
        const { data } = await axiosAuth.post<PlanogramAnalysisResponse>(
            "/space-detection/analyze-planogram",
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                timeout: 120000,
            },
        );

        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
            const message = backendMessage || "Planogram analysis failed. Please try again.";
            logger.error("Planogram analysis error:", message);
            throw new Error(message);
        }

        logger.error("Unexpected planogram analysis error:", error);
        throw new Error("An unexpected error occurred while analyzing the planogram.");
    }
};
