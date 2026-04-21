export default async function handler(req, res) {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        return res.status(500).json({ error: "BACKEND_URL not configured" });
    }

    // Constructs the final URL (e.g., http://[ip]/api/v1/users/login)
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
        const fetchOptions = {
            method: req.method,
            headers: forwardedHeaders,
        };

        if (hasBody) {
            // If Vercel already parsed the body, we need to send it as a string
            // Otherwise, we pass the request object itself (which is a readable stream)
            if (req.body && Object.keys(req.body).length > 0) {
                fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
            } else {
                fetchOptions.body = req;
                fetchOptions.duplex = "half"; // Required for streaming in Node fetch
            }
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Set status and forward headers
        res.status(response.status);
        
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) res.setHeader("Set-Cookie", setCookie);
        
        const contentType = response.headers.get("content-type");
        if (contentType) res.setHeader("Content-Type", contentType);

        // Forward the response body
        const data = await response.text();
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: "Proxy error", details: error.message });
    }
}