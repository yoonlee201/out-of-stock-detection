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
