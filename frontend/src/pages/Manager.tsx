import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    apiGetEmployees,
    apiSendInvitation,
    apiUpdateEmployee,
    apiUpdateEmployeeStatus,
    apiDeleteEmployee,
} from "../api/query/user";
import { formatDate } from "../utils/functions";
import { type UserRole, type EmployeeStatus, type Employee } from "../types/db";
import { EMPLOYEE_ROLES, STATUSES, STATUS_DOT, STATUS_TEXT } from "../utils/constants";
import Dialog from "../_components/Dialog";
import Dropdown from "../_components/Dropdown";
import { PlusIcon, TrashIcon } from "../_components/Icons";
import DataTable, { FilterBar, FilterGroup, SearchInput, SummaryCard } from "../_components/Table";
import Select from "../_components/Select";

// ======================Types========================

type SortField = "firstName" | "email" | "role" | "status" | "phone" | "joinedAt";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "role" | "status";
type EmployeeRole = Exclude<UserRole, "customer">;

// ======================Constants for Table========================

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

// ======================Main Manager Component========================

const Manager = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [fetching, setFetching] = useState(true);
    const [openInvite, setOpenInvite] = useState(false);

    useEffect(() => {
        // phone defaults to "" so inputs stay controlled
        apiGetEmployees()
            .then((rows) => setEmployees(rows.map((e) => ({ ...e, id: String(e.id), phone: e.phone ?? "" }))))
            .catch(() => toast.error("Failed to load employees."))
            .finally(() => setFetching(false));
    }, []);

    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const inactive = employees.filter((e) => e.status === "inactive").length;
    const pending = employees.filter((e) => e.status === "pending").length;

    return (
        <>
            <div className="px-8 py-6">
                <header className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">People</h1>
                        <p className="text-text-muted mt-0.5 text-sm">
                            Manage and collaborate within your organization's teams
                        </p>
                    </div>
                    <button
                        onClick={() => setOpenInvite(true)}
                        className="hover:bg-primary-hover bg-primary inline-flex items-center gap-2 rounded-full px-2.5 py-2.5 text-sm font-semibold text-white transition-colors lg:rounded-xl lg:px-4"
                    >
                        <PlusIcon />
                        <span className="hidden lg:block">Add member</span>
                    </button>
                </header>

                <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <SummaryCard label="Total Employees" value={total} />
                    <SummaryCard label="Active" value={active} valueClass="text-green" />
                    <SummaryCard label="Inactive" value={inactive} valueClass="text-text-muted" />
                    <SummaryCard label="Pending" value={pending} valueClass="text-yellow" />
                </div>

                <EmployeeTables employees={employees} setEmployees={setEmployees} fetching={fetching} />
            </div>

            <InviteDialog open={openInvite} setOpen={setOpenInvite} />
        </>
    );
};

// ======================Empolyee Table========================

type EmployeeTablesProps = {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    fetching: boolean;
};

const EmployeeTables = ({ employees, setEmployees, fetching }: EmployeeTablesProps) => {
    const [filters, setFilters] = useState({
        search: "",
        role: "all" as "all" | UserRole,
        status: "active" as "all" | EmployeeStatus,
        sortField: "status" as SortField,
        sortDir: "asc" as SortDir,
        groupBy: "none" as GroupBy,
    });
    const [editTarget, setEditTarget] = useState<Employee | null>(null);

    const handleSort = (field: SortField) => {
        // same field = toggle direction, new field = reset to asc
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

    const hasActiveFilters =
        filters.role !== "all" || filters.status !== "active" || filters.groupBy !== "none" || filters.search;

    const resetFilters = () =>
        setFilters({ search: "", role: "all", status: "active", sortField: "status", sortDir: "asc", groupBy: "none" });

    const renderRows = (groupKey: string, page?: number, pageSize?: number) => {
        const source = filters.groupBy === "none" ? filtered : grouped[groupKey] || [];
        const rows =
            page && pageSize && filters.groupBy === "none"
                ? source.slice((page - 1) * pageSize, page * pageSize)
                : source;
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
                <td>{e.phone ? `(${e.phone.slice(0, 3)}) ${e.phone.slice(3, 6)}-${e.phone.slice(6)}` : "—"}</td>
                <td className="text-text-secondary px-5 py-4 text-sm">{formatDate(e.joinedAt)}</td>
                <td className="px-5 py-4 text-right">
                    <button
                        onClick={() => setEditTarget(e)}
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

    return (
        <>
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
                        onClick={resetFilters}
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
                totalItems={filtered.length}
                resetKey={`${filters.search}-${filters.role}-${filters.status}-${filters.groupBy}`}
            />

            <EditDialog target={editTarget} setEmployees={setEmployees} onClose={() => setEditTarget(null)} />
        </>
    );
};
// ======================Dialogs========================

type InviteState = { email: string; role: EmployeeRole; loading: boolean };

const InviteDialog = ({ open, setOpen }: { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) => {
    const [invite, setInvite] = useState<InviteState>({
        email: "",
        role: "associate" as EmployeeRole,
        loading: false,
    });

    const handleInvite = async () => {
        if (!invite.email) return;
        setInvite((s) => ({ ...s, loading: true }));
        try {
            await apiSendInvitation(invite.email, invite.role);
            toast.success("Invitation sent successfully.");
            setOpen(false);
            setInvite({ email: "", role: "associate" as EmployeeRole, loading: false });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
        } finally {
            setInvite((s) => ({ ...s, loading: false }));
        }
    };

    return (
        <Dialog
            open={open}
            title="Invite New Employee"
            description="They'll receive an email with instructions to join."
            onClose={() => setOpen(false)}
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
            <Select
                label="Role"
                labelClassName="mt-3"
                value={invite.role}
                onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value as EmployeeRole }))}
            >
                {EMPLOYEE_ROLES.map((role) => (
                    <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                ))}
            </Select>
            <div className="mt-5 flex justify-end gap-2">
                <button
                    onClick={() => setOpen(false)}
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
    );
};

type EditDialogProps = {
    target: Employee | null;
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    onClose: () => void;
};

const EditDialog = ({ target, setEmployees, onClose }: EditDialogProps) => {
    const [form, setForm] = useState<Partial<Employee>>({});

    // sync form when a new employee is opened
    useEffect(() => {
        if (target) {
            setForm({
                firstName: target.firstName,
                lastName: target.lastName,
                email: target.email,
                phone: target.phone,
                role: target.role,
            });
        }
    }, [target]);

    const setField = (field: keyof Employee, value: string) => setForm((f) => ({ ...f, [field]: value }));

    const handleSave = async () => {
        if (!target) return;
        try {
            await apiUpdateEmployee(Number(target.id), {
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                phone: form.phone,
                role: form.role,
            });
            setEmployees((prev) => prev.map((e) => (e.id === target.id ? { ...e, ...form } : e)));
            toast.success("Employee updated.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update employee.");
        }
    };

    const handleStatusChange = async (status: EmployeeStatus) => {
        if (!target) return;
        try {
            await apiUpdateEmployeeStatus(Number(target.id), status);
            setEmployees((prev) => prev.map((e) => (e.id !== target.id ? e : { ...e, status })));
            toast.success(`Employee set to ${status}.`);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update employee status.");
        }
    };

    const handleDelete = async () => {
        if (!target) return;
        if (!window.confirm("Delete this employee? This will permanently remove both user and employee data.")) return;
        try {
            await apiDeleteEmployee(Number(target.id));
            setEmployees((prev) => prev.filter((e) => e.id !== target.id));
            toast.success("Employee deleted successfully.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete employee.");
        }
    };

    return (
        <Dialog open={!!target} title="Edit Employee" description="Update employee details." onClose={onClose}>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="text-text-muted mb-1 block text-xs font-semibold">First Name</label>
                    <input
                        value={form.firstName ?? ""}
                        onChange={(e) => setField("firstName", e.target.value)}
                        className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-text-muted mb-1 block text-xs font-semibold">Last Name</label>
                    <input
                        value={form.lastName ?? ""}
                        onChange={(e) => setField("lastName", e.target.value)}
                        className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
            </div>
            <div className="mt-3">
                <label className="text-text-muted mb-1 block text-xs font-semibold">Email</label>
                <input
                    value={form.email ?? ""}
                    onChange={(e) => setField("email", e.target.value)}
                    className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                />
            </div>
            <div className="mt-3">
                <label className="text-text-muted mb-1 block text-xs font-semibold">Phone</label>
                <input
                    value={form.phone ?? ""}
                    onChange={(e) => setField("phone", e.target.value)}
                    className="focus:ring-primary border-border bg-surface w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                />
            </div>
            <div className="mt-3">
                <Select
                    label="Role"
                    labelClassName="text-text-muted text-xs"
                    value={form.role ?? "associate"}
                    onChange={(e) => setField("role", e.target.value)}
                    options={EMPLOYEE_ROLES.map((role) => ({
                        value: role,
                        label: role.charAt(0).toUpperCase() + role.slice(1),
                    }))}
                />
            </div>

            {/* status toggle — only shown for active/inactive, not other statuses */}
            {target?.status === "active" && (
                <EmployeeStatusChange
                    label="Set as Inactive"
                    description="Employee is off shift and will not appear as active."
                    actionLabel="Inactivate"
                    colorClass="text-red-600"
                    bgClass="bg-red-50 hover:bg-red-100"
                    onClick={() => handleStatusChange("inactive")}
                />
            )}
            {target?.status === "inactive" && (
                <EmployeeStatusChange
                    label="Set as Active"
                    description="Employee is on shift and will appear as active."
                    actionLabel="Activate"
                    colorClass="text-green-600"
                    bgClass="bg-green-50 hover:bg-green-100"
                    onClick={() => handleStatusChange("active")}
                />
            )}

            <div className="mt-5 flex justify-end gap-2">
                <button
                    onClick={handleDelete}
                    className="mr-auto rounded-xl px-2 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                    <TrashIcon />
                </button>
                <button
                    onClick={onClose}
                    className="text-text-muted hover:bg-surface-muted rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="hover:bg-primary-hover bg-primary rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                    Save
                </button>
            </div>
        </Dialog>
    );
};

const EmployeeStatusChange = ({
    label,
    description,
    actionLabel,
    colorClass,
    bgClass,
    onClick,
}: {
    label: string;
    description: string;
    actionLabel: string;
    colorClass: string;
    bgClass: string;
    onClick: () => void;
}) => (
    <div className="border-border mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
        <div>
            <p className="text-text-secondary text-sm font-medium">{label}</p>
            <p className="text-text-muted mt-0.5 text-xs">{description}</p>
        </div>
        <button
            onClick={onClick}
            className={`ml-4 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${colorClass} ${bgClass}`}
        >
            {actionLabel}
        </button>
    </div>
);

export default Manager;
