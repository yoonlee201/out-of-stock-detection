import React, { useState, useEffect } from "react";
import { type UserRole, type EmployeeStatus, type Employee } from "../types/db";
import Sidebar from "../_components/Sidebar";
import Dialog from "../_components/Dialog";
import Dropdown from "../_components/Dropdown";
import Checkbox from "../_components/Checkbox";
import { apiGetEmployees, apiSendInvitation } from "../api/query/user";
import { toast } from "sonner";
import { formatDate } from "../utils/functions";

const STATUS_STYLES: Record<EmployeeStatus, string> = {
    active: "bg-green/10 text-green",
    inactive: "bg-gray-100 text-gray-400",
    pending: "bg-yellow/10 text-yellow",
};

const ROLE_STYLES: Record<UserRole, string> = {
    associate: "bg-blue/10 text-blue",
    manager: "bg-primary/10 text-primary",
    customer: "bg-red/10 text-red",
};

type SortField = "firstName" | "email" | "role" | "status" | "phone" | "joinedAt";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "role" | "status";

const EMPLOYEE_ROLES: UserRole[] = ["associate", "manager"];
const STATUSES: EmployeeStatus[] = ["active", "pending", "inactive"];

const ChevronIcon = ({ dir }: { dir: SortDir }) => (
    <svg
        className={`ml-1 inline h-3 w-3 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
);

const Manager = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [fetching, setFetching] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({
        search: "",
        role: "all" as "all" | UserRole,
        status: "active" as "all" | EmployeeStatus,
        sortField: "status" as SortField,
        sortDir: "asc" as SortDir,
        groupBy: "none" as GroupBy,
    });
    const [invite, setInvite] = useState({
        open: false,
        email: "",
        role: "associate" as "associate" | "manager",
        loading: false,
    });
    const [edit, setEdit] = useState<{ target: Employee | null; form: Partial<Employee> }>({
        target: null,
        form: {},
    });

    // Get, filter, sort, and group employees for display
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
        .filter((e) => e.role !== "customer")
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
            const av = filters.sortField === "firstName" ? `${a.firstName} ${a.lastName}` : (a[filters.sortField] ?? "");
            const bv = filters.sortField === "firstName" ? `${b.firstName} ${b.lastName}` : (b[filters.sortField] ?? "");
            return filters.sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
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

    // Check if all/some rows are selected for bulk actions
    const allChecked = filtered.length > 0 && filtered.every((e) => selected.has(e.id!));
    const someChecked = filtered.some((e) => selected.has(e.id!));

    const toggleAll = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allChecked) {
                filtered.forEach((e) => next.delete(e.id!));
            } else {
                filtered.forEach((e) => next.add(e.id!));
            }
            return next;
        });
    };
    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleStatus = (id: string) => {
        setEmployees((prev) =>
            prev.map((e) => {
                if (e.id !== id) return e;
                return { ...e, status: e.status === "active" ? "inactive" : "active" };
            }),
        );
        toast.success("Status updated.");
    };

    // Edit employee details
    // TODO: Integrate with backend to persist changes
    const openEdit = (e: Employee) =>
        setEdit({
            target: e,
            form: { firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone, role: e.role },
        });

    const handleEditSave = () => {
        if (!edit.target) return;
        setEmployees((prev) => prev.map((e) => (e.id === edit.target!.id ? { ...e, ...edit.form } : e)));
        toast.success("Employee updated.");
        setEdit({ target: null, form: {} });
    };

    // Invite new employee by email
    const handleInvite = async () => {
        if (!invite.email) return;
        setInvite((s) => ({ ...s, loading: true }));
        try {
            await apiSendInvitation(invite.email, invite.role);
            toast.success("Invitation sent successfully.");
            setInvite({ open: false, email: "", role: "associate", loading: false });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
        } finally {
            setInvite((s) => ({ ...s, loading: false }));
        }
    };

    const renderRows = (rows: Employee[]) =>
        rows.map((e) => (
            <tr
                key={e.id}
                className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${selected.has(e.id!) ? "bg-tertiary/5" : ""}`}
            >
                <td className="px-8 py-4">
                    <Checkbox checked={selected.has(e.id!)} onChange={() => toggleOne(e.id!)} />
                </td>
                <td className="hover:text-primary cursor-pointer px-4 py-4 font-medium text-gray-900 underline underline-offset-2 transition-colors">
                    {e.firstName} {e.lastName}
                </td>
                <td className="px-4 py-4 text-gray-500">{e.email}</td>
                <td className="px-4 py-4">
                    <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[e.role]}`}
                    >
                        {e.role}
                    </span>
                </td>
                <td className="px-4 py-4">
                    <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}
                    >
                        {e.status}
                    </span>
                </td>
                <td className="px-4 py-4 text-gray-500">{e.phone}</td>
                <td className="px-4 py-4 text-xs text-gray-400">{formatDate(e.joinedAt)}</td>
                <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openEdit(e)}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        >
                            Edit
                        </button>
                    </div>
                </td>
            </tr>
        ));

    const hasActiveFilters =
        filters.role !== "all" || filters.status !== "active" || filters.groupBy !== "none" || filters.search;
    const resetFilters = () =>
        setFilters({ search: "", role: "all", status: "active", sortField: "status", sortDir: "asc", groupBy: "none" });

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex flex-1 flex-col">
                {/* Top bar */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
                    <span className="text-sm font-medium text-gray-700">Employees ({filtered.length})</span>
                    <button
                        onClick={() => setInvite((s) => ({ ...s, open: true }))}
                        className="bg-primary hover:bg-primary-hover inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Invite Employee
                    </button>
                </div>

                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-8 py-3">
                    <label className="mr-2 flex cursor-pointer items-center gap-2 text-sm text-gray-600 select-none">
                        <Checkbox
                            checked={allChecked}
                            indeterminate={someChecked && !allChecked}
                            onChange={toggleAll}
                        />
                        {selected.size > 0 ? `${selected.size} Selected` : "0 Selected"}
                    </label>

                    <div className="h-4 w-px bg-gray-200" />

                    <Dropdown
                        label="Role"
                        sectionLabel="Filter by role"
                        value={filters.role}
                        onChange={(v) => setFilters((f) => ({ ...f, role: v as "all" | UserRole }))}
                        options={[
                            { value: "all", label: "All roles" },
                            { value: "associate", label: "Associate" },
                            { value: "manager", label: "Manager" },
                        ]}
                    />
                    <Dropdown
                        label="Status"
                        sectionLabel="Filter by status"
                        value={filters.status}
                        onChange={(v) => setFilters((f) => ({ ...f, status: v as "all" | EmployeeStatus }))}
                        options={[
                            { value: "all", label: "All statuses" },
                            { value: "active", label: "Active" },
                            { value: "pending", label: "Pending" },
                            { value: "inactive", label: "Inactive" },
                        ]}
                    />
                    <Dropdown
                        label="Group"
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
                            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
                        >
                            Clear
                        </button>
                    )}

                    <div className="ml-auto flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5">
                        <svg
                            className="h-3.5 w-3.5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            className="w-40 text-xs text-gray-700 outline-none placeholder:text-gray-400"
                        />
                    </div>
                </div>

                <div className="flex-1 bg-white">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="w-10 px-8 py-3" />
                                {[
                                    { field: "firstName" as SortField, label: "Name" },
                                    { field: "email" as SortField, label: "Email" },
                                    { field: "role" as SortField, label: "Role" },
                                    { field: "status" as SortField, label: "Status" },
                                    { field: "phone" as SortField, label: "Phone" },
                                    { field: "joinedAt" as SortField, label: "Joined" },
                                ].map(({ field, label }) => (
                                    <th
                                        key={field}
                                        onClick={() => handleSort(field)}
                                        className="cursor-pointer px-4 py-3 text-xs font-semibold tracking-wider text-gray-400 uppercase transition-colors select-none hover:text-gray-600"
                                    >
                                        {label}
                                        {filters.sortField === field && <ChevronIcon dir={filters.sortDir} />}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {fetching ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-gray-400">
                                        Loading employees…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-gray-400">
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
                                                    colSpan={8}
                                                    className="px-8 py-2 text-xs font-bold tracking-wider text-gray-400 uppercase"
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
                    onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value as "associate" | "manager" }))}
                    className="focus:ring-primary w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
                >
                    <option value="associate">Associate</option>
                    <option value="manager">Manager</option>
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
                        <option value="associate">Associate</option>
                        <option value="manager">Manager</option>
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
                                toggleStatus(edit.target!.id!);
                                setEdit({ target: null, form: {} });
                            }}
                            className="bg-red/10 text-red hover:bg-red/20 ml-4 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                            Deactivate
                        </button>
                    </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
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
                        Save Changes
                    </button>
                </div>
            </Dialog>
        </div>
    );
};

export default Manager;
