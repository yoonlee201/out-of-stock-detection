import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

    // Proxy target for all backend routes.
    // Default: local Docker service (backend:8000).
    // Override for remote dev (e.g. EC2) by setting BACKEND_PROXY_TARGET in
    // frontend/.env to something like https://api.your-domain.com — no code
    // change needed to switch between local and EC2.
    const backendTarget = process.env.BACKEND_PROXY_TARGET || "http://backend:8000";

    return {
        plugins: [react(), tailwindcss()],
        root: "./",
        server: {
            host: true,
            port: 5173,
            strictPort: true,
            watch: {
                usePolling: true,
            },
            allowedHosts: [
                ".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.dev", ".ngrok.io",
                ".amazonaws.com", ".compute.amazonaws.com",
            ],
            proxy: {
                "/users":          { target: backendTarget, changeOrigin: true },
                "/products":       { target: backendTarget, changeOrigin: true },
                "/shelf-analysis": { target: backendTarget, changeOrigin: true },
                "/alerts":         { target: backendTarget, changeOrigin: true },
                "/reorders":       { target: backendTarget, changeOrigin: true },
            },
        },
    };
});
