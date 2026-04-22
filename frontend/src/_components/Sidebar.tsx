import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LogoutIcon } from "./Icons";
import useRouter from "../hooks/useRouter";

const Sidebar = () => {
    const { user, logout } = useAuth();
    const { dashboardRoutes } = useRouter(user?.role || null);
    const navigate = useNavigate();
    const location = useLocation();

    const navBtn = (label: string, path: string) => {
        const isActive = location.pathname === path;
        return (
            <button
                key={label}
                onClick={() => navigate(path)}
                className={`group relative w-full overflow-hidden border-l-2 px-8 py-3.5 text-left text-xs font-bold tracking-[0.2em] transition-colors duration-50 ${
                    isActive
                        ? "border-primary text-primary bg-[var(--color-primary)]/10"
                        : "text-primary hover:border-primary hover:text-primary border-transparent"
                }`}
            >
                {!isActive && (
                    <span className="absolute inset-0 -translate-x-full bg-[var(--color-primary)]/5 transition-transform duration-300 ease-out group-hover:translate-x-0" />
                )}
                <span className="relative">{label}</span>
            </button>
        );
    };

    return (
        <nav className="bg-surface border-border fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r">
            <div className="border-border flex flex-col items-center gap-4 border-b px-6 py-8">
                <div
                    className="border-primary flex h-20 w-20 items-center justify-center rounded-full border-4 text-3xl shadow-[0_0_24px_rgba(205,26,26,0.2)]"
                    // style={{ backgroundColor: "var(--color-background)" }}
                >
                    📦
                </div>
                <div className="text-center">
                    <p className="text-primary text-base leading-tight font-black tracking-[0.25em] uppercase">
                        Stock Detection
                    </p>
                    <div className="via-primary mt-2 h-px w-full bg-gradient-to-r from-transparent to-transparent" />
                    <p className="text-primary mt-2 text-[10px] font-bold tracking-[0.3em] uppercase">
                        Inventory Command
                    </p>
                </div>
            </div>

            <nav className="mt-5 flex flex-1 flex-col gap-0">
                {dashboardRoutes.map(({ label, path }) => navBtn(label, path))}
            </nav>

            {user && (
                <div className="bg-surface border-border flex items-center justify-between gap-3 border-t px-3 py-3">
                    <div className="overflow-hidden">
                        <p className="text-primary mb-1 truncate text-xs leading-none font-bold tracking-wider uppercase">
                            {user.firstName} {user.lastName}
                        </p>
                        <p className="text-primary text-[9px] font-black tracking-[0.2em] uppercase">{user.role}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="text-primary hover:text-secondary h-6 w-6 transition-colors duration-150"
                    >
                        <LogoutIcon />
                    </button>
                </div>
            )}

            <div className="bg-surface border-border mt-5 border-t px-4 py-3">
                <p className="text-text-muted/50 text-center text-[8px] font-black tracking-[0.3em] uppercase">
                    Semper Fidelis
                </p>
            </div>
        </nav>
    );
};

export default Sidebar;
