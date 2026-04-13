import { isAxiosError } from "axios";
import { axiosAuth } from "..";
import logger from "../../utils/log";

export interface ShelfSkuDetails {
    brand: string;
    product_name: string;
    variant: string;
    size: string;
    confidence: number;
}

export interface ShelfDetection {
    bbox: [number, number, number, number];
    type: "product" | "empty_space";
    sku: ShelfSkuDetails | null;
}

export interface ShelfAnalysisResponse {
    message: string;
    summary: {
        product_count: number;
        empty_space_count: number;
        unique_sku_count: number;
    };
    detections: ShelfDetection[];
    annotated_image: string;
}

export const apiAnalyzeShelf = async (image: File): Promise<ShelfAnalysisResponse> => {
    const formData = new FormData();
    formData.append("image", image);

    try {
        const { data } = await axiosAuth.post<ShelfAnalysisResponse>("/shelf-analysis/analyze", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
            timeout: 1800000,
        });

        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            if (error.code === "ECONNABORTED") {
                throw new Error(
                    "Shelf analysis is taking too long on the current server. Try a simpler shelf image or wait for the model to finish loading, then try again."
                );
            }

            if (!error.response) {
                throw new Error(
                    "Could not reach the shelf analysis server. Make sure the ARC backend is still running and your SSH tunnel to port 8000 is still open."
                );
            }

            const responseData = error.response.data;
            const backendMessage =
                typeof responseData === "object" && responseData !== null
                    ? (responseData as { message?: string }).message
                    : undefined;
            const fallbackHttpMessage = `Shelf analysis request failed with status ${error.response.status}.`;
            const message = backendMessage || fallbackHttpMessage;
            logger.error("Shelf analysis error:", backendMessage || fallbackHttpMessage);
            throw new Error(message);
        }

        logger.error("Unexpected shelf analysis error:", error);
        throw new Error("An unexpected error occurred while analyzing the shelf image.");
    }
};
