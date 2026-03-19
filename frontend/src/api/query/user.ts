import { isAxiosError } from "axios";
import { axiosAuth, axiosDefault } from "..";
import { getUserRole, UserRole, type User } from "../../types/db";
import logger from "../../utils/log";

export const apiRegisterUser = async ({
    email,
    password,
    firstName,
    lastName,
    phone,
}: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
}) => {
    try {
        const { data } = await axiosDefault.post("/users/register", {
            email,
            password,
            first_name: firstName,
            last_name: lastName,
            phone,
        });

        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message =
                "Registration failed: " + error.response?.data?.message || "Registration failed. Please try again.";
            logger.error("Registration failed:", message);
            throw new Error(message);
        }

        logger.error("Unexpected error during registration:", error);
        throw new Error("An unexpected error occurred. Please try again.");
    }
};

export const apiLoginUser = async ({ email, password }: { email: string; password: string }) => {
    try {
        const { data } = await axiosDefault.post("/users/login", {
            email,
            password,
        });
        logger.info("Login successful:", data);
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = "Login failed: " + error.response?.data?.message || "Login failed. Please try again.";
            logger.error("Login failed:", message);
            throw new Error(message);
        }

        logger.error("Unexpected error during login:", error);
        throw new Error("An unexpected error occurred. Please try again.");
    }
};

export const apiLogoutUser = async () => {
    try {
        const response = await axiosAuth.post("users/logout");
        if (response.data.success) {
            return response.data;
        } else {
            throw new Error("Invalid credentials. Please try again.");
        }
    } catch (error) {
        logger.error(error);
    }
};

export const apiValidateUser = async (): Promise<User | undefined> => {
    try {
        const { data, status } = await axiosDefault.get("users/validate");

        if (status === 200 && data && data.success) {
            const user = data.user;

            if (!user || !user.email) {
                return undefined;
            }

            logger.info("User validation successful:", user.role, UserRole[user.role as keyof typeof UserRole]);

            return {
                firstName: user.first_name,
                lastName: user.last_name,

                email: user.email,
                phone: user.phone,

                role: getUserRole(user.role),
                createdAt: user.created_at,
                id: user.id,
            };
        } else {
            throw new Error("User validation failed.");
        }
    } catch (error) {
        logger.error("Error validating user (apiValidateUser):", error);
        return undefined;
    }
};

export const apiGetEmployees = async () => {
    try {
        const { data } = await axiosAuth.get("/users/employees");
        return data.users as {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
            role: string;
            phone: string | null;
            carrier: string | null;
            status: "active" | "inactive" | "pending";
            joined_at: string;
            created_at: string;
        }[];
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to fetch employees.";
            throw new Error(message);
        }
        throw new Error("Failed to fetch employees.");
    }
};

export const apiVerifyInvitation = async (token: string) => {
    try {
        const { data } = await axiosDefault.get("/users/invitation/verify", {
            params: { token },
        });
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to verify invitation.";
            throw new Error(message);
        }
        throw new Error("Failed to verify invitation.");
    }
};

export const apiCompleteInvitation = async ({
    token,
    phone,
    carrier,
}: {
    token: string;
    phone: string;
    carrier: string;
}) => {
    try {
        const { data } = await axiosDefault.post("/users/invitation/complete", {
            token,
            phone,
            carrier,
        });
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to complete invitation.";
            throw new Error(message);
        }
        throw new Error("Failed to complete invitation.");
    }
};
