import type { EmployeeStatus, UserRole } from "../types/db";

export const STATUS_STYLES: Record<EmployeeStatus, string> = {
    active: "bg-green/10 text-green",
    inactive: "bg-gray-100 text-gray-400",
    pending: "bg-yellow/10 text-yellow",
};

export const ROLE_STYLES: Record<UserRole, string> = {
    associate: "bg-blue/10 text-blue",
    manager: "bg-primary/10 text-primary",
    customer: "bg-red/10 text-red",
};

export const EMPLOYEE_ROLES: UserRole[] = ["associate", "manager"];
export const STATUSES: EmployeeStatus[] = ["active", "pending", "inactive"];
