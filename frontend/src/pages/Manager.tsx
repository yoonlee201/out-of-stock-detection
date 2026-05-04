import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    apiGetEmployees,
    apiSendInvitation,
    apiUpdateEmployee,
    apiDeactivateEmployee,
    apiDeleteEmployee,
} from "../api/query/user";
import { apiGetAlertHistory, type AlertHistoryItem } from "../api/query/alert";
import { formatDate } from "../utils/functions";
import { type UserRole, type EmployeeStatus, type Employee } from "../types/db";
import { EMPLOYEE_ROLES, STATUSES, STATUS_DOT, STATUS_TEXT } from "../utils/constants";
import Sidebar from "../_components/Sidebar";
import Dialog from "../_components/Dialog";
import Dropdown from "../_components/Dropdown";
import { ChevronIcon, PlusIcon, SearchIcon, TrashIcon } from "../_components/Icons";
import { useAuth } from "../hooks/useAuth";

type SortField = "firstName" | "email" | "role" | "status" | "phone" | "joinedAt";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "role" | "status";
type EmployeeRole = Exclude<UserRole, "customer">;

const Manager = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
    const [fetchingAlerts, setFetchingAlerts] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [filters, setFilters] = useState({
        search: "",
        role: "all" as "all" | UserRole,
        status: "active" as "all" | EmployeeStatus,
        sortField: "status" as SortField,
        sortDir: "asc" as SortDir,
        groupBy: "none" as GroupBy,
    });
    const [invite, setInvite] = useState<{ open: boolean; email: string; role: EmployeeRole; loading: boolean }>({
        open: false,
        email: "",
        role: "associate" as EmployeeRole,
        loading: false,
    });
    const [edit, setEdit] = useState<{ target: Employee | null; form: Partial<Employee> }>({
        target: null,
        form: {},
    });

    const [reorders, setReorders] = useState<any[]>([]);
    const [creatingReorders, setCreatingReorders] = useState(false);

    useEffect(() => {
        apiGetEmployees()
            .then((rows) => setEmployees(rows.map((e) => ({ ...e, id: String(e.id), phone: e.phone ?? "" }))))
            .catch(() => toast.error("Failed to load employees."))
            .finally(() => setFetching(false));
    }, []);

    useEffect(() => {
        if (user?.role !== "manager" && user?.role !== "supervisor") return;
        setFetchingAlerts(true);
        apiGetAlertHistory()
            .then(setAlertHistory)
            .catch(() => toast.error("Failed to load alert history."))
            .finally(() => setFetchingAlerts(false));
    }, [user?.role]);

    const handleSort = (field: SortField) => {
        setFilters((f) => ({
            ...f,
            sortField: field,
            sortDir: f.sortField === field ? (f.sortDir === "asc" ? "desc" : "asc") : "asc",
        }));
    };

    const filtered = employees
        .filter((e) => filters.role === "all" || e.role === filters.role)
        .filter((e) => filters.status === "all" || e.status === filters.status)
        .filter((e) => {
            const q = filters.search.toLowerCase();
            return (
                !q ||
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
                e.email.toLowerCase().includes(q) ||
                (e.phone ?? "").includes(q)
            );
        })
        .sort((a, b) => {
            const av =
                filters.sortField === "firstName" ? `${a.firstName} ${a.lastName}` : (a[filters.sortField] ?? "");
            const bv =
                filters.sortField === "firstName" ? `${b.firstName} ${b.lastName}` : (b[filters.sortField] ?? "");
            return filters.sortDir === "asc"
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av));
        });

    const grouped: Record<string, Employee[]> =
        filters.groupBy === "none"
            ? { all: filtered }
            : filters.groupBy === "role"
              ? EMPLOYEE_ROLES.reduce(
                    (acc, r) => {
                        acc[r] = filtered.filter((e) => e.role === r);
                        return acc;
                    },
                    {} as Record<string, Employee[]>,
                )
              : STATUSES.reduce(
                    (acc, s) => {
                        acc[s] = filtered.filter((e) => e.status === s);
                        return acc;
                    },
                    {} as Record<string, Employee[]>,
                );

    const groupKeys = filters.groupBy === "none" ? ["all"] : filters.groupBy === "role" ? EMPLOYEE_ROLES : STATUSES;

    const handleDeactivate = async (id: string) => {
        try {
            await apiDeactivateEmployee(Number(id));
            setEmployees((prev) => prev.map((e) => (e.id !== id ? e : { ...e, status: "inactive", role: "customer" })));
            toast.success("Employee deactivated successfully.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to deactivate employee.");
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const confirmed = window.confirm(
            "Delete this employee? This will permanently remove both user and employee data.",
        );
        if (!confirmed) return;
        try {
            await apiDeleteEmployee(Number(id));
            setEmployees((prev) => prev.filter((e) => e.id !== id));
            toast.success("Employee deleted successfully.");
            setEdit({ target: null, form: {} });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete employee.");
        }
    };

    const openEdit = (e: Employee) =>
        setEdit({
            target: e,
            form: { firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone, role: e.role },
        });

    const handleEditSave = async () => {
        if (!edit.target) return;
        try {
            await apiUpdateEmployee(Number(edit.target.id), {
                firstName: edit.form.firstName,
                lastName: edit.form.lastName,
                email: edit.form.email,
                phone: edit.form.phone,
                role: edit.form.role,
            });
            setEmployees((prev) => prev.map((e) => (e.id === edit.target!.id ? { ...e, ...edit.form } : e)));
            toast.success("Employee updated.");
            setEdit({ target: null, form: {} });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update employee.");
        }
    };

    const handleInvite = async () => {
        if (!invite.email) return;
        setInvite((s) => ({ ...s, loading: true }));
        try {
            await apiSendInvitation(invite.email, invite.role);
            toast.success("Invitation sent successfully.");
            setInvite({ open: false, email: "", role: "associate" as EmployeeRole, loading: false });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
        } finally {
            setInvite((s) => ({ ...s, loading: false }));
        }
    };

    const handleCreateReorders = async () => {
        setCreatingReorders(true);
        try {
            const res = await fetch("http://localhost:8000/alerts/create_reorders", {
                method: "POST",
            });

            const data = await res.json();

            if (data.success) {
                setReorders(data.reorders);
                toast.success("Reorders created successfully.");
            } else {
                toast.error(data.message || "Failed to create reorders.");
            }
        } catch (err) {
            toast.error("Error creating reorders.");
        } finally {
            setCreatingReorders(false);
        }
    };

    const renderRows = (rows: Employee[]) =>
        rows.map((e) => (
            <tr key={e.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                {/* Name + email stacked */}
                <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                        {e.firstName} {e.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{e.email}</p>
                </td>
                {/* Role — plain text, no capsule */}
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{e.role}</td>
                {/* Status — dot + text, no capsule */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[e.status]}`} />
                        <span className="text-sm text-gray-600">{STATUS_TEXT[e.status]}</span>
                    </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{e.phone}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{formatDate(e.joinedAt)}</td>
                {/* Actions — kebab / edit button */}
                <td className="px-4 py-3 text-right">
                    <button
                        onClick={() => openEdit(e)}
                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Edit employee"
                    >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="4" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="16" r="1.5" />
                        </svg>
                    </button>
                </td>
            </tr>
        ));

    const hasActiveFilters =
        filters.role !== "all" || filters.status !== "active" || filters.groupBy !== "none" || filters.search;
    const resetFilters = () =>
        setFilters({ search: "", role: "all", status: "active", sortField: "status", sortDir: "asc", groupBy: "none" });

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />

            <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between px-8 py-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">People</h1>
                        <p className="mt-0.5 text-sm text-gray-400">
                            Manage and collaborate within your organization's teams
                        </p>
                    </div>
                    <button
                        onClick={() => setInvite((s) => ({ ...s, open: true }))}
                        className="bg-secondary hover:bg-secondary-hover inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        <PlusIcon />
                        Add member
                    </button>
                </div>

                <div className="mx-8 mb-6 rounded-md border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-md font-semibold text-gray-900">Reorder System</h2>
                            <p className="text-xs text-gray-400">Create mock reorders for low-stock products</p>
                        </div>

                        <button
                            onClick={handleCreateReorders}
                            disabled={creatingReorders}
                            className="bg-primary hover:bg-primary-hover rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
                        >
                            {creatingReorders ? "Creating..." : "Create Reorders"}
                        </button>
                    </div>

                    {reorders.length > 0 && (
                        <div className="mt-4">
                            <p className="mb-2 text-sm font-medium text-gray-700">Recent Reorders:</p>
                            <div className="space-y-1 text-sm text-gray-600">
                                {reorders.map((r) => (
                                    <div key={r.reorder_id} className="flex justify-between">
                                        <span>Product {r.product_id}</span>
                                        <span>Qty: {r.quantity}</span>
                                        <span className="text-gray-400">#{r.reorder_id}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {(user?.role === "manager" || user?.role === "supervisor") && (
                    <div className="mx-8 mb-6 rounded-md border border-gray-200 bg-white">
                        <div className="border-b border-gray-200 px-4 py-4">
                            <h2 className="text-md font-semibold text-gray-900">Alert History</h2>
                            <p className="text-xs text-gray-400">Recent out-of-stock alerts sent to employees</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Time</th>
                                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Notified</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fetchingAlerts ? (
                                        <tr>
                                            <td colSpan={5} className="py-10 text-center text-gray-400">Loading…</td>
                                        </tr>
                                    ) : alertHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-10 text-center text-gray-400">No alerts sent yet.</td>
                                        </tr>
                                    ) : (
                                        alertHistory.map((a) => (
                                            <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{formatDate(a.sent_time)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium capitalize text-rose-700">
                                                        {a.alert_type.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-900">{a.product.name}</td>
                                                <td className="px-4 py-3 text-gray-500">Shelf {a.product.shelf}, Aisle {a.product.aisle}</td>
                                                <td className="px-4 py-3 text-gray-500">
                                                    {a.user.first_name} {a.user.last_name}
                                                    <span className="ml-1 text-xs text-gray-400">({a.user.email})</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3 px-8 pb-4">
                    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
                        {(["all", ...STATUSES] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilters((f) => ({ ...f, status: s }))}
                                className={`rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                                    filters.status === s
                                        ? "bg-gray-900 text-white"
                                        : "text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 rounded-sm border border-gray-200 bg-white px-3 py-2">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Search"
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            className="w-48 text-sm text-gray-700 outline-none placeholder:text-gray-400"
                        />
                    </div>

                    <Dropdown
                        label="Filters"
                        sectionLabel="Filter by role"
                        value={filters.role}
                        onChange={(v) => setFilters((f) => ({ ...f, role: v as "all" | UserRole }))}
                        options={[
                            { value: "all", label: "All roles" },
                            ...EMPLOYEE_ROLES.map((role) => ({
                                value: role,
                                label: role.charAt(0).toUpperCase() + role.slice(1),
                            })),
                        ]}
                    />
                    <Dropdown
                        label="Sort by"
                        sectionLabel="Group by"
                        value={filters.groupBy}
                        onChange={(v) => setFilters((f) => ({ ...f, groupBy: v as GroupBy }))}
                        options={[
                            { value: "none", label: "No grouping" },
                            { value: "role", label: "Role" },
                            { value: "status", label: "Status" },
                        ]}
                    />

                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="text-xs text-gray-400 transition-colors hover:text-gray-600"
                        >
                            Clear
                        </button>
                    )}

                    <span className="ml-auto text-sm text-gray-400">
                        {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
                    </span>
                </div>
                <div className="mx-8 overflow-hidden rounded-md border border-gray-200 bg-white">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                                {[
                                    { field: "firstName", label: "Name" },
                                    { field: "role", label: "Job title" },
                                    { field: "status", label: "Employment Type" },
                                    { field: "phone", label: "Phone" },
                                    { field: "joinedAt", label: "Date" },
                                ].map(({ field, label }) => (
                                    <th
                                        onClick={() => handleSort(field as SortField)}
                                        className={`cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase transition-colors select-none hover:text-gray-700`}
                                    >
                                        {label}
                                        {filters.sortField === field && (
                                            <ChevronIcon
                                                className={`ml-1 inline h-3 w-3 ${filters.sortDir === "desc" ? "rotate-180" : ""}`}
                                            />
                                        )}
                                    </th>
                                ))}
                                <th className="w-10 px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {fetching ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-gray-400">
                                        Loading…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-gray-400">
                                        No employees found.
                                    </td>
                                </tr>
                            ) : filters.groupBy === "none" ? (
                                renderRows(grouped["all"])
                            ) : (
                                groupKeys.map((key) =>
                                    grouped[key]?.length > 0 ? (
                                        <React.Fragment key={key}>
                                            <tr className="border-b border-gray-100 bg-gray-50">
                                                <td
                                                    colSpan={6}
                                                    className="px-4 py-2 text-xs font-semibold tracking-wider text-gray-400 uppercase"
                                                >
                                                    {key} ({grouped[key].length})
                                                </td>
                                            </tr>
                                            {renderRows(grouped[key])}
                                        </React.Fragment>
                                    ) : null,
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <Dialog
                open={invite.open}
                title="Invite New Employee"
                description="They'll receive an email with instructions to join."
                onClose={() => setInvite((s) => ({ ...s, open: false }))}
            >
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email Address</label>
                <input
                    autoFocus
                    type="email"
                    placeholder="name@company.com"
                    value={invite.email}
                    onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2"
                />
                <label className="mt-3 mb-1.5 block text-sm font-medium text-gray-700">Role</label>
                <select
                    value={invite.role}
                    onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value as EmployeeRole }))}
                    className="focus:ring-primary w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
                >
                    {EMPLOYEE_ROLES.map((role) => (
                        <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                    ))}
                </select>
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        onClick={() => setInvite((s) => ({ ...s, open: false }))}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInvite}
                        disabled={!invite.email || invite.loading}
                        className="bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {invite.loading ? "Sending…" : "Send Invitation"}
                    </button>
                </div>
            </Dialog>
            <Dialog
                open={!!edit.target}
                title="Edit Employee"
                description="Update employee details."
                onClose={() => setEdit({ target: null, form: {} })}
            >
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">First Name</label>
                        <input
                            value={edit.form.firstName ?? ""}
                            onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, firstName: e.target.value } }))}
                            className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Last Name</label>
                        <input
                            value={edit.form.lastName ?? ""}
                            onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, lastName: e.target.value } }))}
                            className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                    <input
                        value={edit.form.email ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, email: e.target.value } }))}
                        className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
                    <input
                        value={edit.form.phone ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, phone: e.target.value } }))}
                        className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                    <select
                        value={edit.form.role ?? "associate"}
                        onChange={(e) =>
                            setEdit((s) => ({ ...s, form: { ...s.form, role: e.target.value as UserRole } }))
                        }
                        className="focus:ring-primary w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    >
                        {EMPLOYEE_ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                {edit.target?.status === "active" && (
                    <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Deactivate Employee</p>
                            <p className="mt-0.5 text-xs text-gray-400">Employee will lose access to the system.</p>
                        </div>
                        <button
                            onClick={() => {
                                handleDeactivate(edit.target!.id!);
                                setEdit({ target: null, form: {} });
                            }}
                            className="ml-4 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                            Deactivate
                        </button>
                    </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    {edit.target && (
                        <button
                            onClick={() => handleDeleteEmployee(edit.target!.id!)}
                            className="mr-auto rounded-lg px-2 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                            <TrashIcon />
                        </button>
                    )}
                    <button
                        onClick={() => setEdit({ target: null, form: {} })}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleEditSave}
                        className="bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        Save
                    </button>
                </div>
            </Dialog>
        </div>
    );
};

export default Manager;
