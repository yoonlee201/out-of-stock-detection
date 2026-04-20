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
                        ? "border-secondary bg-secondary/10 text-secondary"
                        : "text-primary hover:border-secondary hover:text-secondary border-transparent"
                }`}
            >
                {!isActive && (
                    <span className="bg-secondary/5 absolute inset-0 -translate-x-full transition-transform duration-300 ease-out group-hover:translate-x-0" />
                )}
                <span className="relative">{label}</span>
            </button>
        );
    };

    return (
        <div className="fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-black/10 bg-white">
            <div className="flex flex-col items-center gap-4 border-b border-black/10 px-6 py-8">
                <div className="border-secondary flex h-20 w-20 items-center justify-center rounded-full border-4 bg-white text-3xl shadow-[0_0_24px_rgba(205,26,26,0.2)]">
                    📦
                </div>
                <div className="text-center">
                    <p className="text-primary text-base leading-tight font-black tracking-[0.25em] uppercase">
                        Stock Detection
                    </p>
                    <div className="via-secondary mt-2 h-px w-full bg-gradient-to-r from-transparent to-transparent" />
                    <p className="text-secondary mt-2 text-[10px] font-bold tracking-[0.3em] uppercase">
                        Inventory Command
                    </p>
                </div>
            </div>

            <nav className="mt-5 flex flex-1 flex-col gap-0">
                {dashboardRoutes.map(({ label, path }) => navBtn(label, path))}
            </nav>

            {user && (
                <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-white px-3 py-3">
                    <div className="overflow-hidden">
                        <p className="text-primary mb-1 truncate text-xs leading-none font-bold tracking-wider uppercase">
                            {user.firstName} {user.lastName}
                        </p>
                        <p className="text-secondary text-[9px] font-black tracking-[0.2em] uppercase">{user.role}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="text-secondary hover:text-tertiary h-6 w-6 transition-colors duration-150"
                    >
                        <LogoutIcon />
                    </button>
                </div>
            )}
            <div className="border-t border-black/10 bg-white px-4 py-3">
                <p className="text-center text-[8px] font-black tracking-[0.3em] text-black/20 uppercase">
                    Semper Fidelis
                </p>
            </div>
        </div>
    );
};

export default Sidebar;
