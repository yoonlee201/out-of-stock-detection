export default async function handler(req, res) {
    const backendUrl = process.env.BACKEND_URL; // http://[public_ip]
    console.log("Received request:", req.method, req.url);
    console.log("backendUrl:", backendUrl);
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
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: forwardedHeaders,
            // Use req.body directly; Vercel parses JSON bodies automatically
            body: hasBody ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined,
        });

        res.status(response.status);

        // Forward essential headers
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) res.setHeader("Set-Cookie", setCookie);
        
        const contentType = response.headers.get("content-type");
        if (contentType) res.setHeader("Content-Type", contentType);

        const data = await response.text();
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: "Proxy error", details: error.message });
    }
}