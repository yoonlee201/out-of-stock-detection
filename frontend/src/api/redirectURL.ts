import logger from "../utils/log";
export function redirectURL(url: string): void {
    if (!url) {
        logger.error("URL is required to redirect.");
        return;
    }
    window.location.href = `${url}`;
}
