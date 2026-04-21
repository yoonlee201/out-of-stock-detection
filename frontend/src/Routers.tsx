// Routers.tsx
import { Route, Navigate, Routes, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { type User } from "./types/db";
import useRouter from "./hooks/useRouter";
import Sidebar from "./_components/Sidebar";

const DashboardLayout = () => (
    <div className="flex">
        <Sidebar />
        <main className="ml-64 min-h-screen flex-1">
            <Outlet />
        </main>
    </div>
);

const ProtectedRoute = ({ loading, user }: { loading: boolean; user: User | null }) => {
    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    backgroundColor: "var(--color-background)",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "24px", marginBottom: "16px" }}>Loading...</div>
                    <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>Please wait</div>
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
                <Route element={<DashboardLayout />}>
                    {dashboardRoutes.map(({ path, element }, i) => (
                        <Route
                            key={i}
                            path={path}
                            element={
                                <div className="flex min-h-screen bg-(--color-background)">
                                    <Sidebar />
                                    <div className="flex-1 overflow-y-auto p-8">{element}</div>
                                </div>
                            }
                        />
                    ))}
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default Routers;
