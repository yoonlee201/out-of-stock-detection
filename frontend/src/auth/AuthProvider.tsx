// auth/AuthProvider.tsx
import { useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import type { User } from "../types/db";
import { apiLoginUser, apiLogoutUser, apiValidateUser } from "../api/query/user";
import logger from "../utils/log";

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            setLoading(true);
            const user = await apiValidateUser();
            if (user) {
                setUser(user);
            } else {
                setUser(null);
            }
        } catch (error) {
            logger.error("Auth check failed:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Check authentication on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (email: string): Promise<void> => {
        try {
            const data = await apiLoginUser({ email });
            if (data) {
                await checkAuth();
            }
        } catch (error) {
            logger.error("Login error:", error);
            throw error;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await apiLogoutUser();
            setUser(null);
        } catch (error) {
            logger.error("Logout error:", error);
            throw error;
        }
    };

    return <AuthContext.Provider value={{ user, login, logout, loading, checkAuth }}>{children}</AuthContext.Provider>;
};
