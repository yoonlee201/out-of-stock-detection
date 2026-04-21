// Routers.tsx
import { Route, Navigate, Routes, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { type User } from "./types/db";
import useRouter from "./hooks/useRouter";
import Sidebar from "./_components/Sidebar";

const DashboardLayout = () => (
    <div className="flex min-h-screen bg-background text-text">
        <Sidebar />
        <main className="ml-64 flex-1 overflow-y-auto p-8 text-text">
            <Outlet />
        </main>
    </div>
);

const ProtectedRoute = ({ loading, user }: { loading: boolean; user: User | null }) => {
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <div className="mb-4 text-2xl text-text">Loading...</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Please wait</div>
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
                        <Route key={i} path={path} element={element} />
                    ))}
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default Routers;
