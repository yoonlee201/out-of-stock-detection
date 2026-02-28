export const UserRole = {
    ASSOCIATE: "associate",
    MANAGER: "manager",
    CUSTOMER: "customer",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
    id?: string;
    firstName: string;
    lastName: string;

    email: string;
    phone: string;

    password?: string;
    role: UserRole;
    createdAt: string;
}
