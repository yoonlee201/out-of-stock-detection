import React, { useState, useEffect } from "react";
import { type UserRole } from "../types/db";
import Sidebar from "../_components/Sidebar";

interface Associate {
    id: string;
    name: string;
    email: string;
    status: "active" | "inactive" | "pending";
    role: UserRole;
    invitedAt?: string;
}

const STATUS_STYLES: Record<Associate["status"], string> = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    inactive: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
};

const ROLE_STYLES: Record<UserRole, string> = {
    associate: "bg-blue-50 text-blue-700",
    manager: "bg-violet-50 text-violet-700",
    customer: "bg-rose-50 text-rose-700",
};

const Manager = () => {
    const [associates, setAssociates] = useState<Associate[]>([]);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [filterRole, setFilterRole] = useState<"all" | UserRole>("all");
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        // fetchAssociates();
    }, []);

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3500);
            return () => clearTimeout(t);
        }
    }, [message]);

    // const fetchAssociates = async () => {
    //     setLoading(true);
    //     try {
    //         const response = await fetch('/api/associates');
    //         const data = await response.json();
    //         setAssociates(data);
    //     } catch {
    //         setMessage({ text: 'Failed to load associates', type: 'error' });
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const handleStatusChange = async (id: string, newStatus: Associate['status']) => {
    //     try {
    //         await fetch(`/api/associates/${id}/status`, {
    //             method: 'PUT',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ status: newStatus }),
    //         });
    //         setAssociates(associates.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    //         setMessage({ text: 'Status updated successfully', type: 'success' });
    //     } catch {
    //         setMessage({ text: 'Failed to update status', type: 'error' });
    //     }
    // };

    // const handleInvite = async () => {
    //     if (!newEmail) return;
    //     setLoading(true);
    //     try {
    //         const response = await fetch('/api/associates/invite', {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ email: newEmail }),
    //         });
    //         if (response.ok) {
    //             setMessage({ text: 'Invitation sent successfully', type: 'success' });
    //             setNewEmail('');
    //             setOpenDialog(false);
    //             fetchAssociates();
    //         }
    //     } catch {
    //         setMessage({ text: 'Failed to send invitation', type: 'error' });
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const filteredAssociates = associates.filter((a) => filterRole === "all" || a.role === filterRole);

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <div className="border-b border-slate-200 bg-white px-8 py-5">
                <div className="mx-auto flex max-w-6xl items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Manager Dashboard</h1>
                        <p className="mt-0.5 text-sm text-slate-500">Manage team members and their access</p>
                    </div>
                    <button
                        onClick={() => setOpenDialog(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Invite Associate
                    </button>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-8 py-6">
                {/* Toast */}
                {message && (
                    <div
                        className={`mb-5 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                            message.type === "error"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                    >
                        {message.type === "error" ? (
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        ) : (
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {message.text}
                        <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="mb-5 flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-1">
                    {(["all", "associate", "manager", "customer"] as const).map((role) => (
                        <button
                            key={role}
                            onClick={() => setFilterRole(role)}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                                filterRole === role ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {role === "all" ? "All" : role}
                        </button>
                    ))}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                    Name
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                    Email
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                    Role
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                    Status
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                                    </td>
                                </tr>
                            ) : filteredAssociates.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-sm text-slate-400">
                                        No members found.
                                    </td>
                                </tr>
                            ) : (
                                filteredAssociates.map((associate) => (
                                    <tr key={associate.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">{associate.name}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{associate.email}</td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[associate.role]}`}
                                            >
                                                {associate.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <select
                                                value={associate.status}
                                                onChange={() =>{}}
                                                className={`cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-medium capitalize outline-none ${STATUS_STYLES[associate.status]}`}
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                                <option value="pending">Pending</option>
                                            </select>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100">
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dialog */}
            {openDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setOpenDialog(false)}
                    />
                    <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h2 className="mb-1 text-lg font-semibold text-slate-900">Invite New Associate</h2>
                        <p className="mb-5 text-sm text-slate-500">
                            They'll receive an email with instructions to join.
                        </p>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
                        <input
                            autoFocus
                            type="email"
                            placeholder="name@company.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter"}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition outline-none placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-slate-900"
                        />
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setOpenDialog(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { }}
                                disabled={!newEmail || loading}
                                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {loading ? "Sending…" : "Send Invitation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Manager;
