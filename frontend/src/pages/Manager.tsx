import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    apiGetEmployees,
    apiSendInvitation,
    apiUpdateEmployee,
    apiDeactivateEmployee,
    apiDeleteEmployee,
} from "../api/query/user";
import { formatDate } from "../utils/functions";
import { type UserRole, type EmployeeStatus, type Employee } from "../types/db";
import { EMPLOYEE_ROLES, STATUSES, STATUS_DOT, STATUS_TEXT } from "../utils/constants";
import Dialog from "../_components/Dialog";
import Dropdown from "../_components/Dropdown";
import { PlusIcon, TrashIcon } from "../_components/Icons";
import DataTable, { FilterBar, FilterGroup, SearchInput, SummaryCard } from "../_components/Table";

type SortField = "firstName" | "email" | "role" | "status" | "phone" | "joinedAt";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "role" | "status";
type EmployeeRole = Exclude<UserRole, "customer">;

interface Reorder {
    reorder_id: number | string;
    product_id: number | string;
    quantity: number;
}

const COLUMNS = [
    { field: "firstName" as SortField, label: "Name" },
    { field: "role" as SortField, label: "Job Title" },
    { field: "status" as SortField, label: "Status" },
    { field: "phone" as SortField, label: "Phone" },
    { field: "joinedAt" as SortField, label: "Date" },
];

const STATUS_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
];

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
    const [reorders, setReorders] = useState<Reorder[]>([]);
    const [creatingReorders, setCreatingReorders] = useState(false);

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

    const groupKeys = filters.groupBy === "none" ? undefined : filters.groupBy === "role" ? EMPLOYEE_ROLES : STATUSES;

    const handleDeactivate = async (id: string) => {
        try {
            await apiDeactivateEmployee(Number(id));
            setEmployees((prev) => prev.map((e) => (e.id !== id ? e : { ...e, status: "inactive" })));
            toast.success("Employee set to inactive.");
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
            const res = await fetch("http://localhost:8000/alerts/create_reorders", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setReorders(data.reorders as Reorder[]);
                toast.success("Reorders created successfully.");
            } else {
                toast.error(data.message || "Failed to create reorders.");
            }
        } catch {
            toast.error("Error creating reorders.");
        } finally {
            setCreatingReorders(false);
        }
    };

    const renderRows = (groupKey: string) => {
        const rows = grouped[groupKey] ?? [];
        if (rows.length === 0) {
            return (
                <tr key={`${groupKey}-empty`}>
                    <td colSpan={6} className="text-text-muted py-16 text-center text-sm">
                        No employees found.
                    </td>
                </tr>
            );
        }
        return rows.map((e) => (
            <tr key={e.id} className="border-border hover:bg-surface-muted border-b transition-colors">
                <td className="px-5 py-4">
                    <p className="text-sm font-medium">
                        {e.firstName} {e.lastName}
                    </p>
                    <p className="text-text-muted mt-0.5 text-xs">{e.email}</p>
                </td>
                <td className="text-text-secondary px-5 py-4 text-sm capitalize">{e.role}</td>
                <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[e.status]}`} />
                        <span className="text-text-secondary text-sm">{STATUS_TEXT[e.status]}</span>
                    </div>
                </td>
                <td className="text-text-secondary px-5 py-4 text-sm">{e.phone}</td>
                <td className="text-text-secondary px-5 py-4 text-sm">{formatDate(e.joinedAt)}</td>
                <td className="px-5 py-4 text-right">
                    <button
                        onClick={() => openEdit(e)}
                        className="text-text-muted hover:bg-surface-muted rounded-lg p-1.5 transition-colors"
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
    };

    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const inactive = employees.filter((e) => e.status === "inactive").length;

    const hasActiveFilters =
        filters.role !== "all" || filters.status !== "active" || filters.groupBy !== "none" || filters.search;

    return (
        <>
            <div className="px-8 py-6">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">People</h1>
                        <p className="text-text-muted mt-0.5 text-sm">
                            Manage and collaborate within your organization's teams
                        </p>
                    </div>
                    <button
                        onClick={() => setInvite((s) => ({ ...s, open: true }))}
                        className="hover:bg-primary-hover bg-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                    >
                        <PlusIcon />
                        Add member
                    </button>
                </div>

                <div className="mb-6 grid grid-cols-3 gap-4">
                    <SummaryCard label="Total Employees" value={total} />
                    <SummaryCard label="Active" value={active} valueClass="text-green" />
                    <SummaryCard label="Inactive" value={inactive} valueClass="text-text-muted" />
                </div>

                <div className="bg-surface mb-6 rounded-2xl p-5 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold">Reorder System</h2>
                            <p className="text-text-muted mt-0.5 text-xs">
                                Create mock reorders for low-stock products
                            </p>
                        </div>
                        <button
                            onClick={handleCreateReorders}
                            disabled={creatingReorders}
                            className="hover:bg-primary-hover bg-primary rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                        >
                            {creatingReorders ? "Creating…" : "Create Reorders"}
                        </button>
                    </div>
                    {reorders.length > 0 && (
                        <div className="mt-4">
                            <p className="text-text-secondary mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                                Recent Reorders
                            </p>
                            <div className="text-text-muted space-y-1 text-sm">
                                {reorders.map((r) => (
                                    <div key={r.reorder_id} className="flex justify-between">
                                        <span>Product {r.product_id}</span>
                                        <span>Qty: {r.quantity}</span>
                                        <span>#{r.reorder_id}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <FilterBar>
                    <SearchInput
                        value={filters.search}
                        onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
                        placeholder="Search people…"
                        className="w-1/3"
                    />
                    <FilterGroup
                        options={STATUS_FILTER_OPTIONS}
                        value={filters.status}
                        onChange={(v) => setFilters((f) => ({ ...f, status: v as "all" | EmployeeStatus }))}
                    />
                    <Dropdown
                        label="Role"
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
                        label="Group by"
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
                            onClick={() =>
                                setFilters({
                                    search: "",
                                    role: "all",
                                    status: "active",
                                    sortField: "status",
                                    sortDir: "asc",
                                    groupBy: "none",
                                })
                            }
                            className="text-text-muted hover:bg-surface-muted rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </FilterBar>

                <DataTable
                    columns={COLUMNS}
                    sortField={filters.sortField}
                    sortDir={filters.sortDir}
                    onSort={handleSort}
                    loading={fetching}
                    groupKeys={groupKeys}
                    renderRows={renderRows}
                    actionColumn
                />
            </div>

            <Dialog
                open={invite.open}
                title="Invite New Employee"
                description="They'll receive an email with instructions to join."
                onClose={() => setInvite((s) => ({ ...s, open: false }))}
            >
                <label className="text-text-secondary mb-1.5 block text-sm font-medium">Email Address</label>
                <input
                    autoFocus
                    type="email"
                    placeholder="name@company.com"
                    value={invite.email}
                    onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    className="focus:ring-primary border-border bg-surface placeholder:text-text-muted w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
                />
                <label className="text-text-secondary mt-3 mb-1.5 block text-sm font-medium">Role</label>
                <select
                    value={invite.role}
                    onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value as EmployeeRole }))}
                    className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
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
                        className="text-text-muted hover:bg-surface-muted rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInvite}
                        disabled={!invite.email || invite.loading}
                        className="hover:bg-primary-hover bg-primary rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
                        <label className="text-text-muted mb-1 block text-xs font-semibold">First Name</label>
                        <input
                            value={edit.form.firstName ?? ""}
                            onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, firstName: e.target.value } }))}
                            className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-text-muted mb-1 block text-xs font-semibold">Last Name</label>
                        <input
                            value={edit.form.lastName ?? ""}
                            onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, lastName: e.target.value } }))}
                            className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="text-text-muted mb-1 block text-xs font-semibold">Email</label>
                    <input
                        value={edit.form.email ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, email: e.target.value } }))}
                        className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="text-text-muted mb-1 block text-xs font-semibold">Phone</label>
                    <input
                        value={edit.form.phone ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, phone: e.target.value } }))}
                        className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="text-text-muted mb-1 block text-xs font-semibold">Role</label>
                    <select
                        value={edit.form.role ?? "associate"}
                        onChange={(e) =>
                            setEdit((s) => ({ ...s, form: { ...s.form, role: e.target.value as UserRole } }))
                        }
                        className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    >
                        {EMPLOYEE_ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                {edit.target?.status === "active" && (
                    <div className="border-border mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
                        <div>
                            <p className="text-text-secondary text-sm font-medium">Set as Inactive</p>
                            <p className="text-text-muted mt-0.5 text-xs">
                                Employee is off shift and will not appear as active.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                handleDeactivate(edit.target!.id!);
                                setEdit({ target: null, form: {} });
                            }}
                            className="ml-4 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                        >
                            Inactivate
                        </button>
                    </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    {edit.target && (
                        <button
                            onClick={() => handleDeleteEmployee(edit.target!.id!)}
                            className="mr-auto rounded-xl px-2 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                            <TrashIcon />
                        </button>
                    )}
                    <button
                        onClick={() => setEdit({ target: null, form: {} })}
                        className="text-text-muted hover:bg-surface-muted rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleEditSave}
                        className="hover:bg-primary-hover bg-primary rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        Save
                    </button>
                </div>
            </Dialog>
        </>
    );
};

export default Manager;
