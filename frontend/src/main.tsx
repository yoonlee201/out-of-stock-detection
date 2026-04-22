import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import Routers from "./Routers";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
};
updateTheme(mediaQuery);
mediaQuery.addEventListener("change", updateTheme);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <Routers />
            </AuthProvider>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
    </StrictMode>,
);
