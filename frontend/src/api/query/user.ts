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

export const apiGetUsers = async () => {
    try {
        const { data } = await axiosAuth.get("/users");
        return data.users as { id: number; first_name: string; last_name: string; email: string; created_at: string }[];
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to fetch users.";
            throw new Error(message);
        }
        throw new Error("Failed to fetch users.");
    }
};

export const apiSendInvitation = async (email: string, role: "associate" | "supervisor" | "manager") => {
    try {
        const { data } = await axiosAuth.patch(`/users/send_invitation`, { role, email });
        return data as { message: string; invitation_link: string; expires_in_hours: number };
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to send invitation.";
            throw new Error(message);
        }
        throw new Error("Failed to send invitation.");
    }
};

export const apiGetEmployees = async () => {
    try {
        const { data } = await axiosAuth.get("/users/employees");

        const employees = data.users as {
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
        return employees.map((e) => ({
            id: e.id,
            firstName: e.first_name,
            lastName: e.last_name,
            email: e.email,
            role: getUserRole(e.role),
            phone: e.phone || "",
            status: e.status,
            joinedAt: e.joined_at,
            createdAt: e.created_at,
        }));
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
    firstName,
    lastName,
    password,
    isNew,
}: {
    token: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    isNew: boolean;
}) => {
    try {
        const { data } = await axiosDefault.post("/users/invitation/complete", {
            token,
            phone,
            first_name: firstName,
            last_name: lastName,
            password,
            is_new: isNew,
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

export const apiVerifyEmail = async (token: string) => {
    try {
        const { data } = await axiosDefault.get("/users/verify-email", {
            params: { token },
        });
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to verify email.";
            throw new Error(message);
        }
        throw new Error("Failed to verify email.");
    }
};

export const apiUpdateEmployee = async (
    id: number,
    fields: { firstName?: string; lastName?: string; email?: string; phone?: string; role?: string },
) => {
    try {
        const { data } = await axiosAuth.patch(`/users/${id}`, {
            first_name: fields.firstName,
            last_name: fields.lastName,
            email: fields.email,
            phone: fields.phone,
            role: fields.role,
        });
        return data;
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to update employee.";
            throw new Error(message);
        }
        throw new Error("Failed to update employee.");
    }
};

export const apiDeactivateEmployee = async (employeeId: number) => {
    try {
        const { data } = await axiosAuth.patch(`/users/${employeeId}/deactivate`);
        return data as { message: string };
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to deactivate employee.";
            throw new Error(message);
        }
        throw new Error("Failed to deactivate employee.");
    }
};

export const apiDeleteEmployee = async (employeeId: number) => {
    try {
        const { data } = await axiosAuth.delete(`/users/${employeeId}/employee`);
        return data as { message: string };
    } catch (error: unknown) {
        if (isAxiosError(error)) {
            const message = error.response?.data?.message || "Failed to delete employee.";
            throw new Error(message);
        }
        throw new Error("Failed to delete employee.");
    }
};
