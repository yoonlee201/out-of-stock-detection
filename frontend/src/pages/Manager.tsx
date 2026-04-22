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
import { ChevronIcon, PlusIcon, SearchIcon, TrashIcon } from "../_components/Icons";

type SortField = "firstName" | "email" | "role" | "status" | "phone" | "joinedAt";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "role" | "status";
type EmployeeRole = Exclude<UserRole, "customer">;

interface Reorder {
    reorder_id: number | string;
    product_id: number | string;
    quantity: number;
}

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

    const groupKeys = filters.groupBy === "none" ? ["all"] : filters.groupBy === "role" ? EMPLOYEE_ROLES : STATUSES;

    // Deactivate = mark as inactive (off shift). Role is preserved.
    // Delete = permanently removes the employee record entirely.
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

    const renderRows = (rows: Employee[]) =>
        rows.map((e) => (
            <tr key={e.id} className="border-border hover-surface border-b transition-colors">
                <td className="px-4 py-3">
                    <p className="text-sm font-medium">
                        {e.firstName} {e.lastName}
                    </p>
                    <p className="text-text-muted mt-0.5 text-xs">{e.email}</p>
                </td>
                <td className="text-text-muted px-4 py-3 text-sm capitalize">{e.role}</td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[e.status]}`} />
                        <span className="text-text-muted text-sm">{STATUS_TEXT[e.status]}</span>
                    </div>
                </td>
                <td className="text-text-muted px-4 py-3 text-sm">{e.phone}</td>
                <td className="text-text-muted px-4 py-3 text-sm">{formatDate(e.joinedAt)}</td>
                <td className="px-4 py-3 text-right">
                    <button
                        onClick={() => openEdit(e)}
                        className="hover-surface-btn text-text-muted rounded p-1.5 transition-colors"
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
        <>
            <div>
                <div className="flex items-start justify-between px-8 py-6">
                    <div>
                        <h1 className="text-xl font-semibold">People</h1>
                        <p className="text-text-muted mt-0.5 text-sm">
                            Manage and collaborate within your organization's teams
                        </p>
                    </div>
                    <button
                        onClick={() => setInvite((s) => ({ ...s, open: true }))}
                        className="hover:bg-[var(--color-primary)]-hover inline-flex items-center gap-2 rounded-sm bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        <PlusIcon />
                        Add member
                    </button>
                </div>

                {/* Reorder System */}
                <div className="border-border bg-surface mx-8 mb-6 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-md font-semibold">Reorder System</h2>
                            <p className="text-text-muted text-xs">Create mock reorders for low-stock products</p>
                        </div>
                        <button
                            onClick={handleCreateReorders}
                            disabled={creatingReorders}
                            className="hover:bg-[var(--color-primary)]-hover rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
                        >
                            {creatingReorders ? "Creating..." : "Create Reorders"}
                        </button>
                    </div>

                    {reorders.length > 0 && (
                        <div className="mt-4">
                            <p className="text-text-secondary mb-2 text-sm font-medium">Recent Reorders:</p>
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

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-3 px-8 pb-4">
                    <div className="border-border bg-surface flex items-center gap-1 rounded-md border p-1">
                        {(["all", ...STATUSES] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilters((f) => ({ ...f, status: s }))}
                                className="rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition-colors"
                                style={
                                    filters.status === s
                                        ? { backgroundColor: "var(--color-text)", color: "var(--color-background)" }
                                        : { color: "var(--color-text-muted)" }
                                }
                            >
                                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="border-border bg-surface flex items-center gap-2 rounded-sm border px-3 py-2">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Search"
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            className="placeholder:text-text-muted w-48 bg-transparent text-sm outline-none"
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
                            onClick={resetFilters}
                            className="hover-surface-btn text-text-muted rounded px-1 py-0.5 text-xs transition-colors"
                        >
                            Clear
                        </button>
                    )}

                    <span className="text-text-muted ml-auto text-sm">
                        {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Table */}
                <div className="border-border bg-surface mx-8 overflow-hidden rounded-md border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-muted">
                            <tr className="border-border border-b">
                                {[
                                    { field: "firstName", label: "Name" },
                                    { field: "role", label: "Job title" },
                                    { field: "status", label: "Employment Type" },
                                    { field: "phone", label: "Phone" },
                                    { field: "joinedAt", label: "Date" },
                                ].map(({ field, label }) => (
                                    <th
                                        key={field}
                                        onClick={() => handleSort(field as SortField)}
                                        className="text-text-muted cursor-pointer px-4 py-3 text-left text-xs font-medium tracking-wider uppercase transition-colors select-none"
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
                                    <td colSpan={6} className="text-text-muted py-20 text-center">
                                        Loading…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-text-muted py-20 text-center">
                                        No employees found.
                                    </td>
                                </tr>
                            ) : filters.groupBy === "none" ? (
                                renderRows(grouped["all"])
                            ) : (
                                groupKeys.map((key) =>
                                    grouped[key]?.length > 0 ? (
                                        <React.Fragment key={key}>
                                            <tr className="border-border bg-surface-muted border-b">
                                                <td
                                                    colSpan={6}
                                                    className="text-text-muted px-4 py-2 text-xs font-semibold tracking-wider uppercase"
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

            {/* Invite Dialog */}
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
                    className="focus:ring-primary border-border bg-surface placeholder:text-text-muted w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
                />
                <label className="text-text-secondary mt-3 mb-1.5 block text-sm font-medium">Role</label>
                <select
                    value={invite.role}
                    onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value as EmployeeRole }))}
                    className="focus:ring-primary border-border bg-surface w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
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
                        className="hover-surface-btn text-text-muted rounded px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInvite}
                        disabled={!invite.email || invite.loading}
                        className="hover:bg-[var(--color-primary)]-hover rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
                        <label className="text-text-muted mb-1 block text-xs font-medium">First Name</label>
                        <input
                            value={edit.form.firstName ?? ""}
                            onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, firstName: e.target.value } }))}
                            className="focus:ring-primary border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-text-muted mb-1 block text-xs font-medium">Last Name</label>
                        <input
                            value={edit.form.lastName ?? ""}
                            onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, lastName: e.target.value } }))}
                            className="focus:ring-primary border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="text-text-muted mb-1 block text-xs font-medium">Email</label>
                    <input
                        value={edit.form.email ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, email: e.target.value } }))}
                        className="focus:ring-primary border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="text-text-muted mb-1 block text-xs font-medium">Phone</label>
                    <input
                        value={edit.form.phone ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, form: { ...s.form, phone: e.target.value } }))}
                        className="focus:ring-primary border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="text-text-muted mb-1 block text-xs font-medium">Role</label>
                    <select
                        value={edit.form.role ?? "associate"}
                        onChange={(e) =>
                            setEdit((s) => ({ ...s, form: { ...s.form, role: e.target.value as UserRole } }))
                        }
                        className="focus:ring-primary border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    >
                        {EMPLOYEE_ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                {edit.target?.status === "active" && (
                    <div className="border-border mt-4 flex items-center justify-between rounded-lg border px-4 py-3">
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
                            className="ml-4 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                           Inactivate
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
                        className="hover-surface-btn text-text-muted rounded px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleEditSave}
                        className="hover:bg-[var(--color-primary)]-hover rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors"
                    >
                        Save
                    </button>
                </div>
            </Dialog>
        </>
    );
};

export default Manager;