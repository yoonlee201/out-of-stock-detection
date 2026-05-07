// Routers.tsx
import { useState } from "react";
import { Route, Navigate, Routes, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { type User } from "./types/db";
import useRouter from "./hooks/useRouter";
import Sidebar from "./_components/Sidebar";
import HelpBot from "./_components/HelpBot";

const DashboardLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    return (
        <div className="bg-background text-text flex min-h-screen">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Mobile-only backdrop when the sidebar drawer is open */}
            {sidebarOpen && (
                <div
                    aria-hidden
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                />
            )}

            {/* Mobile-only hamburger button, top-left */}
            <button
                type="button"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
                className="bg-surface border-border text-text fixed top-3 left-3 z-20 rounded-lg border p-2 shadow-md lg:hidden"
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>

            <main className="text-text flex-1 overflow-y-auto p-4 pt-16 sm:p-6 sm:pt-16 lg:ml-64 lg:p-8 lg:pt-8">
                <Outlet />
            </main>
            <HelpBot />
        </div>
    );
};

const ProtectedRoute = ({ loading, user }: { loading: boolean; user: User | null }) => {
    if (loading) {
        return (
            <div className="bg-background flex h-screen items-center justify-center">
                <div className="text-center">
                    <div className="text-text mb-4 text-2xl">Loading...</div>
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
