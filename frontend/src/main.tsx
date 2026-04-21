import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import Routers from "./Routers";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const applySystemTheme = (isDark: boolean) => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
};

applySystemTheme(themeQuery.matches);

const handleThemeChange = (event: MediaQueryListEvent) => {
    applySystemTheme(event.matches);
};

// Support modern + older browsers
if (themeQuery.addEventListener) {
    themeQuery.addEventListener("change", handleThemeChange);
} else {
    themeQuery.addListener(handleThemeChange);
}

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
