// Routers.tsx
import { BrowserRouter, Route, Navigate, Routes, Outlet } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Manager from "./pages/Manager";
import Invitation from "./pages/Invitation";
import VerifyEmail from "./pages/VerifyEmail";
import SpaceDetection from "./pages/SpaceDetection";

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

const ManagerRoute = () => {
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
            >           <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "24px", marginBottom: "16px" }}>Loading...</div>
                    <div style={{ fontSize: "14px", color: "#666" }}>Please wait</div>
                </div>
            </div>
        );
    }
    
    if (!user || (user.role !== "manager" && user.role !== "supervisor")) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

function Routers() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/continue" element={<Invitation />} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/space-detection" element={<SpaceDetection />} />
                    </Route>
                    <Route element={<ManagerRoute />}>
                        <Route path="/employee-management" element={<Manager />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default Routers;
