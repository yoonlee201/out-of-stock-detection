import { isAxiosError } from "axios";
import { axiosAuth } from "..";
import type { ActiveJobInfo, AnalysisHistoryEntry, JobStatus, JobSubmitResponse } from "../../types/shelfAnalysis";

const DIRECT_URL = import.meta.env.VITE_BACKEND_BASE_URL
    ? `${import.meta.env.VITE_BACKEND_BASE_URL}${import.meta.env.VITE_BACKEND_URL}`
    : import.meta.env.VITE_BACKEND_URL;

const resolveEndpoint = (path: string) => (DIRECT_URL ? `${DIRECT_URL}${path}` : path);

export const apiSubmitAnalysis = async (
    image: File,
    onUploadProgress?: (percent: number) => void,
): Promise<JobSubmitResponse> => {
    const formData = new FormData();
    formData.append("image", image);

    try {
        const { data } = await axiosAuth.post<JobSubmitResponse>(resolveEndpoint("/shelf-analysis/analyze"), formData, {
            timeout: 120000,
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: onUploadProgress
                ? (event) => {
                      if (event.total) {
                          onUploadProgress(Math.round((event.loaded / event.total) * 100));
                      }
                  }
                : undefined,
        });
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            if (!error.response) {
                throw new Error("Could not reach the shelf analysis server. Make sure the backend is running.");
            }
            const msg =
                (error.response.data as { message?: string })?.message ||
                `Submission failed with status ${error.response.status}.`;
            throw new Error(msg);
        }
        throw new Error("An unexpected error occurred while submitting the image.");
    }
};

export const apiGetActiveJobs = async (): Promise<ActiveJobInfo[]> => {
    try {
        const { data } = await axiosAuth.get<ActiveJobInfo[]>(resolveEndpoint("/shelf-analysis/jobs"));
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const msg = (error.response?.data as { message?: string })?.message || "Failed to load active jobs.";
            throw new Error(msg);
        }
        throw new Error("Failed to load active jobs.");
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
