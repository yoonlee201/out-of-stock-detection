import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

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
            allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.dev", ".ngrok.io"],
            proxy: {
                "/users":          { target: "http://backend:8000", changeOrigin: true },
                "/products":       { target: "http://backend:8000", changeOrigin: true },
                "/shelf-analysis": { target: "http://backend:8000", changeOrigin: true },
                "/alerts":         { target: "http://backend:8000", changeOrigin: true },
                "/reorders":       { target: "http://backend:8000", changeOrigin: true },
            },
        },
    };
});
