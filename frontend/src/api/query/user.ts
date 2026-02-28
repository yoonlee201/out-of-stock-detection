import { isAxiosError } from "axios";
import { axiosAuth, axiosDefault } from "..";
import type { User } from "../../types/db";
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
            const message = "Registration failed: " + error.response?.data?.message || "Registration failed. Please try again.";
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
            return {
                firstName: user.first_name,
                lastName: user.last_name,

                email: user.email,
                phone: user.phone,

                role: user.role,
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
