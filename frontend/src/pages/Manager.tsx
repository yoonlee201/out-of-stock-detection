import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiGetEmployees, apiSendInvitation, apiUpdateEmployee, apiDeactivateEmployee, apiDeleteEmployee } from "../api/query/user";
import { formatDate } from "../utils/functions";
import { type UserRole, type EmployeeStatus, type Employee } from "../types/db";
import { EMPLOYEE_ROLES, ROLE_STYLES, STATUSES, STATUS_STYLES } from "../utils/constants";
import Sidebar from "../_components/Sidebar";
import Dialog from "../_components/Dialog";
import Dropdown from "../_components/Dropdown";
import { ChevronIcon, PlusIcon, SearchIcon, TrashIcon } from "../_components/Icons";

type SortField = "firstName" | "email" | "role" | "status" | "phone" | "joinedAt";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "role" | "status";
type EmployeeRole = Exclude<UserRole, "customer">;

const Manager = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
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

    useEffect(() => {
        apiGetEmployees()
            .then((rows) => setEmployees(rows.map((e) => ({ ...e, id: String(e.id), phone: e.phone ?? "" }))))
            .catch(() => toast.error("Failed to load employees."))
            .finally(() => setFetching(false));
    }, []);

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

    const renderRows = (rows: Employee[]) =>
        rows.map((e) => (
            <tr key={e.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                <td className="px-4 py-3 w-1/4">
                    <p className="text-sm font-medium text-gray-900">
                        {e.firstName} {e.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{e.email}</p>
                </td>
                <td className="px-4 py-3">
                    <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[e.role]}`}
                    >
                        {e.role}
                    </span>
                </td>
                <td className="px-4 py-3">
                    <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}
                    >
                        {e.status}
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{e.phone}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{formatDate(e.joinedAt)}</td>
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
                        className="bg-primary hover:bg-primary-hover inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        <PlusIcon />
                        Add member
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 px-8 pb-4">
                    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                        {(["all", ...STATUSES] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilters((f) => ({ ...f, status: s }))}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${filters.status === s
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
