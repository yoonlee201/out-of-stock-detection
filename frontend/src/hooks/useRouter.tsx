import Dashboard from "../pages/Dashboard";
import Invitation from "../pages/Invitation";
import Login from "../pages/Login";
import Manager from "../pages/Manager";
import Register from "../pages/Register";
import VerifyEmail from "../pages/VerifyEmail";
import type { UserRole } from "../types/db";

interface Route {
    path: string;
    label: string;
    element?: React.ReactNode;
}

type Routes = {
    [label: string]: Route;
};

const useRouter = (role: UserRole | null) => {
    const allRoutes: Routes = {
        login: { path: "/login", label: "Login", element: <Login /> },
        register: { path: "/register", label: "Register", element: <Register /> },
        verify_email: { path: "/verify-email", label: "Verify Email", element: <VerifyEmail /> },
        invitation: { path: "/invitation", label: "Invitation", element: <Invitation /> },
        dashboard: { path: "/dashboard", label: "Dashboard", element: <Dashboard /> },
        employee_management: { path: "/employee-management", label: "Employee Management", element: <Manager /> },
        // "Products": { path: "/products", label: "Products", element: <Products /> },
        // "Alerts": { path: "/alerts", label: "Alerts", element: <Alerts /> },
        // "Reorders": { path: "/reorders", label: "Reorders", element: <Reorders /> },
        // "Suppliers": { path: "/suppliers", label: "Suppliers", element: <Suppliers /> },
        // "Settings": { path: "/settings", label: "Settings", element: <Settings /> },
    };

    const authRoutes: Route[] = [allRoutes.login, allRoutes.register, allRoutes.verify_email, allRoutes.invitation];

    const publicSidebarRoutes: Route[] = [allRoutes.dashboard];

    const employeeRoutes: { [key in UserRole]: Route[] } = {
        customer: [],
        associate: [allRoutes.space_detection],
        supervisor: [allRoutes.space_detection, allRoutes.employee_management],
        manager: [allRoutes.space_detection, allRoutes.employee_management],
    };

    const dashboardRoutes = [...publicSidebarRoutes, ...(role && employeeRoutes[role] ? employeeRoutes[role] : [])];

    return { authRoutes, dashboardRoutes };
};

export default useRouter;
