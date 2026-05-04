import Dashboard from "../pages/Dashboard";
import Demo from "../pages/Demo";
import Inventory from "../pages/Inventory";
import Invitation from "../pages/Invitation";
import Login from "../pages/Login";
import Manager from "../pages/Manager";
import Notifications from "../pages/Notifications";
import Register from "../pages/Register";
import VerifyEmail from "../pages/VerifyEmail";
import type { UserRole } from "../types/db";

type Route = {
    path: string;
    label: string;
    element?: React.ReactNode;
};

type Routes = {
    [label: string]: Route;
};

const useRouter = (role: UserRole | null) => {
    const allRoutes: Routes = {
        login: { path: "/login", label: "Login", element: <Login /> },
        register: { path: "/register", label: "Register", element: <Register /> },
        verify_email: { path: "/verify-email", label: "Verify Email", element: <VerifyEmail /> },
        invitation: { path: "/invitation", label: "Invitation", element: <Invitation /> },
        dashboard: { path: "/shelf-detection", label: "Shelf Detection", element: <Dashboard /> },
        inventory: { path: "/inventory", label: "Inventory", element: <Inventory /> },
        notifications: { path: "/notifications", label: "Notifications", element: <Notifications /> },
        employee_management: { path: "/employee-management", label: "Employee Management", element: <Manager /> },
        demo: { path: "/demo", label: "Demo", element: <Demo /> },
        // alerts:   { path: "/alerts",    label: "Alerts",    element: <Alerts /> },
        // reorders: { path: "/reorders",  label: "Reorders",  element: <Reorders /> },
        // suppliers: { path: "/suppliers", label: "Suppliers", element: <Suppliers /> },
        // settings: { path: "/settings",  label: "Settings",  element: <Settings /> },
    };

    const authRoutes: Route[] = [allRoutes.login, allRoutes.register, allRoutes.verify_email, allRoutes.invitation];

    const employeeRoutes: Route[] = [allRoutes.dashboard, allRoutes.employee_management, allRoutes.demo];

    const isEmployee = role !== null && role !== "customer";

    const dashboardRoutes: Route[] = [
        allRoutes.inventory,
        ...(isEmployee ? employeeRoutes : []),
        allRoutes.notifications,
    ];

    return { authRoutes, dashboardRoutes };
};

export default useRouter;
