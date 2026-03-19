import React, { useState, useEffect } from "react";
import { type UserRole, type User } from "../types/db";
import Sidebar from "../_components/Sidebar";
import Dialog from "../_components/Dialog";
import Dropdown from "../_components/Dropdown";
import Checkbox from "../_components/Checkbox";
import { apiGetEmployees } from "../api/query/user";

type EmployeeStatus = "active" | "inactive" | "pending";

interface Employee extends User {
    status: EmployeeStatus;
    joinedAt: string;
}

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
    const [inviteLoading, setInviteLoading] = useState(false);
    const [openInvite, setOpenInvite] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [search, setSearch] = useState("");
    const [filterRole, setFilterRole] = useState<"all" | UserRole>("all");
    const [filterStatus, setFilterStatus] = useState<"all" | EmployeeStatus>("active");
    const [sortField, setSortField] = useState<SortField>("status");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [groupBy, setGroupBy] = useState<GroupBy>("none");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // Edit dialog
    const [editTarget, setEditTarget] = useState<Employee | null>(null);
    const [editForm, setEditForm] = useState<Partial<Employee>>({});

    useEffect(() => {
        apiGetEmployees()
            .then((rows) =>
                setEmployees(
                    rows.map((r) => ({
                        id: String(r.id),
                        firstName: r.first_name,
                        lastName: r.last_name,
                        email: r.email,
                        phone: r.phone ?? "—",
                        role: r.role as UserRole,
                        createdAt: r.created_at,
                        status: r.status,
                        joinedAt: r.joined_at,
                    })),
                ),
            )
            .catch(() => setMessage({ text: "Failed to load employees.", type: "error" }))
            .finally(() => setFetching(false));
    }, []);

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3500);
            return () => clearTimeout(t);
        }
    }, [message]);

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const filtered = employees
        .filter((e) => e.role !== "customer")
        .filter((e) => filterRole === "all" || e.role === filterRole)
        .filter((e) => filterStatus === "all" || e.status === filterStatus)
        .filter((e) => {
            const q = search.toLowerCase();
            return (
                !q ||
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
                e.email.toLowerCase().includes(q) ||
                e.phone.includes(q)
            );
        })
        .sort((a, b) => {
            const av = sortField === "firstName" ? `${a.firstName} ${a.lastName}` : a[sortField];
            const bv = sortField === "firstName" ? `${b.firstName} ${b.lastName}` : b[sortField];
            return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        });

    const grouped: Record<string, Employee[]> =
        groupBy === "none"
            ? { all: filtered }
            : groupBy === "role"
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

    const groupKeys = groupBy === "none" ? ["all"] : groupBy === "role" ? EMPLOYEE_ROLES : STATUSES;

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
                const next: EmployeeStatus = e.status === "active" ? "inactive" : "active";
                return { ...e, status: next };
            }),
        );
        setMessage({ text: "Status updated.", type: "success" });
    };

    const openEdit = (e: Employee) => {
        setEditTarget(e);
        setEditForm({ firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone, role: e.role });
    };

    const handleEditSave = () => {
        if (!editTarget) return;
        setEmployees((prev) => prev.map((e) => (e.id === editTarget.id ? { ...e, ...editForm } : e)));
        setMessage({ text: "Employee updated.", type: "success" });
        setEditTarget(null);
    };

    const handleInvite = () => {
        if (!newEmail) return;
        setInviteLoading(true);
        setTimeout(() => {
            setEmployees((prev) => [
                ...prev,
                {
                    id: String(Date.now()),
                    firstName: newEmail.split("@")[0],
                    lastName: "",
                    email: newEmail,
                    phone: "—",
                    role: "associate",
                    createdAt: new Date().toISOString().split("T")[0],
                    status: "pending",
                    joinedAt: new Date().toISOString().split("T")[0],
                },
            ]);
            setMessage({ text: "Invitation sent successfully", type: "success" });
            setNewEmail("");
            setOpenInvite(false);
            setInviteLoading(false);
        }, 800);
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const SortTh = ({ field, label }: { field: SortField; label: string }) => (
        <th
            onClick={() => handleSort(field)}
            className="cursor-pointer px-4 py-3 text-xs font-semibold tracking-wider text-gray-400 uppercase transition-colors select-none hover:text-gray-600"
        >
            {label}
            {sortField === field && <ChevronIcon dir={sortDir} />}
        </th>
    );

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

    const hasActiveFilters = filterRole !== "all" || filterStatus !== "active" || groupBy !== "none" || search;

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex flex-1 flex-col">
                {/* Top bar */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
                    <span className="text-sm font-medium text-gray-700">Employees ({filtered.length})</span>
                    <button
                        onClick={() => setOpenInvite(true)}
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
                        value={filterRole}
                        onChange={(v) => setFilterRole(v as "all" | UserRole)}
                        options={[
                            { value: "all", label: "All roles" },
                            { value: "associate", label: "Associate" },
                            { value: "manager", label: "Manager" },
                        ]}
                    />
                    <Dropdown
                        label="Status"
                        sectionLabel="Filter by status"
                        value={filterStatus}
                        onChange={(v) => setFilterStatus(v as "all" | EmployeeStatus)}
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
                        value={groupBy}
                        onChange={(v) => setGroupBy(v as GroupBy)}
                        options={[
                            { value: "none", label: "No grouping" },
                            { value: "role", label: "Role" },
                            { value: "status", label: "Status" },
                        ]}
                    />

                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                setFilterRole("all");
                                setFilterStatus("active");
                                setGroupBy("none");
                                setSearch("");
                            }}
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
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-40 text-xs text-gray-700 outline-none placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* Toast */}
                {message && (
                    <div
                        className={`mx-8 mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${message.type === "error"
                                ? "border-red/20 bg-red/5 text-red"
                                : "border-green/20 bg-green/5 text-green"
                            }`}
                    >
                        {message.text}
                        <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100">
                            ✕
                        </button>
                    </div>
                )}
                <div className="flex-1 bg-white">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="w-10 px-8 py-3" />
                                <SortTh field="firstName" label="Name" />
                                <SortTh field="email" label="Email" />
                                <SortTh field="role" label="Role" />
                                <SortTh field="status" label="Status" />
                                <SortTh field="phone" label="Phone" />
                                <SortTh field="joinedAt" label="Joined" />
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
                            ) : groupBy === "none" ? (
                                renderRows(grouped["all"])
                            ) : (
                                groupKeys.map((key) =>
                                    grouped[key]?.length > 0 ? (
                                        <React.Fragment key={key}>
                                            <tr className="border-b border-gray-100 bg-gray-50">
                                                <td
                                                    colSpan={8}
                                                    className="px-8 py-2 text-xs font-bold tracking-wider text-gray-400 capitalize uppercase"
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

            {/* Invite dialog */}
            <Dialog
                open={openInvite}
                title="Invite New Employee"
                description="They'll receive an email with instructions to join."
                onClose={() => setOpenInvite(false)}
            >
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email Address</label>
                <input
                    autoFocus
                    type="email"
                    placeholder="name@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2"
                />
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        onClick={() => setOpenInvite(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInvite}
                        disabled={!newEmail || inviteLoading}
                        className="bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {inviteLoading ? "Sending…" : "Send Invitation"}
                    </button>
                </div>
            </Dialog>

            {/* Edit dialog */}
            <Dialog
                open={!!editTarget}
                title="Edit Employee"
                description="Update employee details."
                onClose={() => setEditTarget(null)}
            >
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">First Name</label>
                        <input
                            value={editForm.firstName ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                            className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Last Name</label>
                        <input
                            value={editForm.lastName ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                            className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                    <input
                        value={editForm.email ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
                    <input
                        value={editForm.phone ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        className="focus:ring-primary w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    />
                </div>
                <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                    <select
                        value={editForm.role ?? "associate"}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                        className="focus:ring-primary w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2"
                    >
                        <option value="associate">Associate</option>
                        <option value="manager">Manager</option>
                    </select>
                </div>
                {editTarget?.status === "active" && (
                    <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                        <div>
                            <p className="text-sm font-medium text-gray-700">
                                {editTarget?.status === "active" ? "Deactivate Employee" : "Activate Employee"}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">{"Employee will lose access to the system."}</p>
                        </div>
                        <button
                            onClick={() => {
                                if (editTarget) {
                                    toggleStatus(editTarget.id!);
                                    setEditTarget(null);
                                }
                            }}
                            className="bg-red/10 text-red hover:bg-red/20 ml-4 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                            {"Deactivate"}
                        </button>
                    </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        onClick={() => setEditTarget(null)}
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
