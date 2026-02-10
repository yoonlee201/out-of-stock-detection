import { axiosAuth, axiosDefault } from "..";
import type { User } from "../../types/db";
import logger from "../../utils/log";

export const apiLoginUser = async ({ email }: { email: string }) => {
    try {
        const { data } = await axiosDefault.post("/users/login", {
            email,
        });
        if (data.success) {
            return data;
        } else logger.error("Login failed:", data.message);
        throw new Error("Invalid credentials. Please try again.");
    } catch (error) {
        logger.error("Error logging in user (apiLoginUser):", error);
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
                email: user.email,
                name: user.name,
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
