export const config = {
    api: { bodyParser: false },
};

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

export default async function handler(req, res) {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        return res.status(500).json({ error: "BACKEND_URL not configured" });
    }

    const targetUrl = `${backendUrl}${req.url}`;

    const skipHeaders = new Set(["host", "connection", "transfer-encoding", "content-length"]);
    const forwardedHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (!skipHeaders.has(key.toLowerCase())) {
            forwardedHeaders[key] = value;
        }
    }

    const hasBody = !["GET", "HEAD"].includes(req.method);

    try {
        const rawBody = hasBody ? await readRawBody(req) : undefined;

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: forwardedHeaders,
            body: rawBody,
        });

        res.status(response.status);

        const setCookie = response.headers.get("set-cookie");
        if (setCookie) res.setHeader("Set-Cookie", setCookie);

        const contentType = response.headers.get("content-type");
        if (contentType) res.setHeader("Content-Type", contentType);

        res.send(await response.text());
    } catch (error) {
        res.status(500).json({ error: "Proxy error", details: error.message });
    }
}
