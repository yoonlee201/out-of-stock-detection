import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "../types/db";
import { LogoutIcon } from "./Icons";

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const navBtn = (label: string, path: string) => {
        const isActive = location.pathname === path;
        return (
            <button
                onClick={() => navigate(path)}
                className={`group relative w-full overflow-hidden border-l-2 px-8 py-3.5 text-left text-xs font-bold tracking-[0.2em] transition-colors duration-50 ${isActive
                        ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-transparent text-primary hover:border-secondary hover:text-secondary"
                    }`}
            >
                {/* Hover slide-in background */}
                {!isActive && (
                    <span className="absolute inset-0 -translate-x-full bg-secondary/5 transition-transform duration-300 ease-out group-hover:translate-x-0" />
                )}
                <span className="relative">{label}</span>
            </button>
        );
    };

    return (
        <div className="flex min-h-screen w-64 flex-col border-r border-black/10 bg-white">

            {/* Logo / Brand */}
            <div className="flex flex-col items-center gap-4 border-b border-black/10 px-6 py-8">
                {/* Replace with: <img src="..." className="w-20 h-20 rounded-full object-cover border-4 border-secondary" /> */}
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-secondary bg-white text-3xl shadow-[0_0_24px_rgba(205,26,26,0.2)]">
                    📦
                </div>
                <div className="text-center">
                    <p className="text-base font-black leading-tight tracking-[0.25em] text-primary uppercase">
                        Stock Detection
                    </p>
                    <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-secondary to-transparent" />
                    <p className="mt-2 text-[10px] font-bold tracking-[0.3em] text-secondary uppercase">
                        Inventory Command
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="mt-5 flex flex-1 flex-col gap-0">
                {navBtn("Dashboard", "/dashboard")}
                {navBtn("Products", "/products")}
                {navBtn("Alerts", "/alerts")}
                {navBtn("Reorders", "/reorders")}
                {navBtn("Suppliers", "/suppliers")}
                {navBtn("Settings", "/settings")}
                {user?.role === UserRole.MANAGER && navBtn("Employee Management", "/employee-management")}
            </nav>

            {/* User chip */}
            {user && (
                <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-white px-3 py-3">
                    <div className="overflow-hidden">
                        <p className="mb-1 truncate text-xs font-bold leading-none tracking-wider text-primary uppercase">
                            {user.firstName} {user.lastName}
                        </p>
                        <p className="text-[9px] font-black tracking-[0.2em] text-secondary uppercase">
                            {user.role}
                        </p>
                    </div>
                    <button onClick={logout} className="h-10 w-10 text-secondary transition-colors duration-150 hover:text-tertiary">
                        <LogoutIcon />
                    </button>
                </div>
            )}

            {/* Bottom motto */}
            <div className="border-t border-black/10 bg-white px-4 py-3">
                <p className="text-center text-[8px] font-black tracking-[0.3em] text-black/20 uppercase">
                    Semper Fidelis
                </p>
            </div>
        </div>
    );
};

export default Sidebar;