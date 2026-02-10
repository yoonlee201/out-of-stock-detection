import { createContext } from "react";
import type { User } from "../types/db";

export interface AuthContextType {
    user: User | null;
    login: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
    checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
