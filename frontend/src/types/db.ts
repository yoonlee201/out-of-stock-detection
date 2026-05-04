export const UserRole = Object.freeze({
    ASSOCIATE: "associate",
    SUPERVISOR: "supervisor",
    MANAGER: "manager",
    CUSTOMER: "customer",
} as const);

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type User = {
    id?: string;
    firstName: string;
    lastName: string;

    email: string;
    phone: string;

    password?: string;
    role: UserRole;
    createdAt: string;
};

export function getUserRole(value: string): UserRole {
    const valid = Object.values(UserRole) as string[];
    if (valid.includes(value)) return value as UserRole;
    return UserRole.CUSTOMER; // default fallback
}

export type EmployeeStatus = "active" | "inactive" | "pending";

export type Employee = User & {
    status: EmployeeStatus;
    joinedAt: string;
};
