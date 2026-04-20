import axios, { type AxiosRequestConfig } from "axios";
import logger from "../utils/log";

// All VITE_* vars are baked into the JS bundle at build time.
// Never log import.meta.env in production — it exposes all build-time config
// (including any VITE_* secrets) to anyone who opens DevTools.
const BASE_URL = import.meta.env.VITE_BACKEND_URL;
const ACCESSTOKEN = import.meta.env.VITE_ACCESS_TOKEN || "accessToken";

export const axiosDefault = axios.create({
    baseURL: BASE_URL,
    timeout: 8000,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

export const axiosAuth = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
    timeout: 60 * 1000, // 60 seconds for larger file operations
});

// axiosAuth.interceptors.response.use(
//     (response) => response,
//     async (error) => {
//         const errorStatus = error.response?.status;

//         if (errorStatus === 401) {
//             // Token is invalid or expired - redirect to login
//             alert('Session expired. Please login again.');
//             window.location.replace('/login');
//         }

//         return Promise.reject(error);
//     },
// );
const refreshAccessToken = async () => {
    try {
        const response = await axios.post(
            `users/reissue`,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                },
                withCredentials: true, // Important: Include credentials to send cookies
            },
        );

        // The new access token should be returned in the response body, not the headers
        const accessToken = response.data.accessToken;
        if (accessToken) {
            return accessToken;
        }
        throw new Error("Failed to obtain new access token");
    } catch (error) {
        logger.error("Error during token reissue:", error);
        throw error;
    }
};

const retryRequestWithNewToken = async (originalRequest: AxiosRequestConfig, newAccessToken: string) => {
    localStorage.setItem(ACCESSTOKEN, newAccessToken);

    const modifiedConfig = { ...originalRequest };
    modifiedConfig.headers = originalRequest.headers || {};
    modifiedConfig.headers.Authorization = `Bearer ${newAccessToken}`;
    try {
        return await axios(originalRequest);
    } catch (error) {
        logger.error("Failed to retry request");
        window.location.replace("/login");
        return Promise.reject(error);
    }
};

axiosAuth.interceptors.request.use(
    async (config) => {
        const modifiedConfig = { ...config };
        const accessToken = localStorage.getItem(ACCESSTOKEN);

        if (accessToken) {
            modifiedConfig.headers.Authorization = `Bearer ${accessToken}`;
        }
        return modifiedConfig;
    },
    (error) => {
        logger.error(error);
        return Promise.reject(error);
    },
);

axiosAuth.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Check if response exists (CORS or network errors won't have a response)
        if (!error.response) {
            logger.error("Network or CORS error:", error.message);
            return Promise.reject(error);
        }

        const errorStatus = error.response.status;
        const originalRequest = error.config;

        if (errorStatus === 401) {
            try {
                const newAccessToken = await refreshAccessToken();
                if (newAccessToken) {
                    return await retryRequestWithNewToken(originalRequest, newAccessToken);
                }
            } catch (error) {
                alert("The session has expired. Please log in again: " + error);
                window.location.replace("/login");
            }
        }
        return Promise.reject(error);
    },
);
