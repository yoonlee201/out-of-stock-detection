// Routers.tsx
import { Route, Navigate, Routes, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { type User } from "./types/db";
import useRouter from "./hooks/useRouter";

const ProtectedRoute = ({ loading, user }: { loading: boolean; user: User | null }) => {
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
    const { user, loading } = useAuth();
    const { authRoutes, dashboardRoutes } = useRouter(user?.role || null);

    return (
        <Routes>
            {authRoutes.map(({ path, element }, i) => (
                <Route key={i} path={path} element={element ?? <></>} />
            ))}
            <Route element={<ProtectedRoute loading={loading} user={user} />}>
                {dashboardRoutes.map(({ path, element }, i) => (
                    <Route key={i} path={path} element={element ?? <></>} />
                ))}
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default Routers;
