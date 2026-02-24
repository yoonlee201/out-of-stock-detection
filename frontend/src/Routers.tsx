// Routers.tsx
import { BrowserRouter, Route, Navigate, Routes, Outlet } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./hooks/useAuth";
import AuthPage from "./AuthPage";

const ProtectedRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    backgroundColor: "#f5f5f5",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "24px", marginBottom: "16px" }}>Loading...</div>
                    <div style={{ fontSize: "14px", color: "#666" }}>Please wait</div>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

function Routers() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<AuthPage />} />
                    <Route element={<ProtectedRoute />}>
                        <Route
                            path="/dashboard"
                            element={<div className="bg-blue-700 text-white">Protected Route</div>}
                        />
                    </Route>
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default Routers;
