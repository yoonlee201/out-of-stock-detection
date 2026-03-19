import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import Routers from "./Routers";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Routers />
        <Toaster position="bottom-right" richColors />
    </StrictMode>,
);
