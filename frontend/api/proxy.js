import http from "node:http";
import https from "node:https";

export default function handler(req, res) {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        res.status(500).json({ error: "BACKEND_URL not configured" });
        return;
    }

    const url = new URL(`${backendUrl}${req.url}`);
    const transport = url.protocol === "https:" ? https : http;
    const defaultPort = url.protocol === "https:" ? 443 : 80;

    const skipHeaders = new Set(["host", "connection", "transfer-encoding"]);
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (!skipHeaders.has(key.toLowerCase())) {
            headers[key] = value;
        }
    }

    const proxyReq = transport.request(
        {
            hostname: url.hostname,
            port: url.port || defaultPort,
            path: url.pathname + url.search,
            method: req.method,
            headers,
        },
        (proxyRes) => {
            res.status(proxyRes.statusCode);

            if (proxyRes.headers["content-type"]) {
                res.setHeader("Content-Type", proxyRes.headers["content-type"]);
            }
            if (proxyRes.headers["set-cookie"]) {
                res.setHeader("Set-Cookie", proxyRes.headers["set-cookie"]);
            }

            proxyRes.pipe(res);
        },
    );

    proxyReq.on("error", (err) => {
        res.status(502).json({ error: "Proxy error", details: err.message });
    });

    req.pipe(proxyReq);
}
