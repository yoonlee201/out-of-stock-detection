import { useEffect, useState } from "react";
import { apiGetAlertHistory, type AlertHistoryItem, type AlertType } from "../api/query/alert";
import { apiGetReorders, type ReorderResult } from "../api/query/reorders";
import { NavLink } from "react-router-dom";

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
    restock: "Restock",
    shelf_detection: "Shelf Detection",
};

const alertTypeClass = (alertType: AlertType): string => {
    switch (alertType) {
        case "restock":
            return "bg-status-misplaced-bg text-status-misplaced-text";
        case "shelf_detection":
            return "bg-status-missing-bg text-status-missing-text";
    }
};


const EmptyState = ({ message }: { message: string }) => (
    <div className="border-border flex min-h-40 items-center justify-center rounded-2xl border border-dashed">
        <p className="text-text-muted text-sm">{message}</p>
    </div>
);

const LoadingState = () => (
    <div className="border-border flex min-h-40 items-center justify-center rounded-2xl border border-dashed">
        <p className="text-text-muted text-sm">Loading...</p>
    </div>
);

const Notifications = () => {
    const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
    const [reorders, setReorders] = useState<ReorderResult[]>([]);
    const [alertLoading, setAlertLoading] = useState(true);
    const [reorderLoading, setReorderLoading] = useState(true);

    useEffect(() => {
        apiGetAlertHistory()
            .then(setAlertHistory)
            .catch(() => setAlertHistory([]))
            .finally(() => setAlertLoading(false));

        apiGetReorders()
            .then(setReorders)
            .catch(() => setReorders([]))
            .finally(() => setReorderLoading(false));
    }, []);

    return (
        <div className="px-8 py-6">
            <header className="mb-6">
                <h1 className="text-3xl font-semibold">Notifications</h1>
                <p className="text-text-muted mt-0.5 text-sm">Alert and reorder activity across your inventory</p>
            </header>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alert History */}
                <div className="bg-surface rounded-xl p-6 shadow">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Alert History</h2>
                        {!alertLoading && alertHistory.length > 0 && (
                            <span className="text-text-muted text-xs font-semibold">
                                {alertHistory.length} total
                            </span>
                        )}
                    </div>

                    {alertLoading ? (
                        <LoadingState />
                    ) : alertHistory.length === 0 ? (
                        <EmptyState message="No alerts have been sent yet." />
                    ) : (
                        <div className="space-y-3">
                            {alertHistory.map((alert) => (
                                <NavLink key={alert.id} to={`/shelf-detection?log_id=${alert.shelf_analysis_log_id}`} className="border-border rounded-2xl border px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase ${alertTypeClass(alert.alert_type)}`}
                                        >
                                            {ALERT_TYPE_LABEL[alert.alert_type]}
                                        </span>
                                        <span className="text-text-muted text-xs">
                                            {alert.sent_time
                                                ? new Date(alert.sent_time).toLocaleString([], {
                                                      dateStyle: "medium",
                                                      timeStyle: "short",
                                                  })
                                                : "No time recorded"}
                                        </span>
                                    </div>
                                    <div className="text-text-muted mt-2 flex flex-wrap gap-4 text-xs">
                                        <span>
                                            Scan:{" "}
                                            {alert.shelf_analysis_log_id !== null
                                                ? `#${alert.shelf_analysis_log_id}`
                                                : "—"}
                                        </span>
                                        {alert.alert_type === "shelf_detection" && (
                                            <>
                                                <span>Missing: {alert.missing}</span>
                                                <span>Misplaced: {alert.misplaced}</span>
                                            </>
                                        )}
                                    </div>
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reorder History */}
                <div className="bg-surface rounded-xl p-6 shadow">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Reorder History</h2>
                        {!reorderLoading && reorders.length > 0 && (
                            <span className="text-text-muted text-xs font-semibold">
                                {reorders.length} total
                            </span>
                        )}
                    </div>

                    {reorderLoading ? (
                        <LoadingState />
                    ) : reorders.length === 0 ? (
                        <EmptyState message="No reorders have been placed yet." />
                    ) : (
                        <div className="space-y-3">
                            {reorders.map((reorder) => {
                                const p = reorder.product;
                                const subtitleParts = p
                                    ? [p.variant, p.size].filter(Boolean)
                                    : [];
                                return (
                                    <div key={reorder.id} className="border-border rounded-2xl border px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-sm font-semibold">{`${p?.brand ? `${p.brand} ` : ''}${p?.name || 'Unnamed Product'}`}</span>
                                            <span className="text-text-muted text-xs">
                                                {new Date(reorder.created_at).toLocaleString([], {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                })}
                                            </span>
                                        </div>
                                        {subtitleParts.length > 0 && (
                                            <div className="text-text-muted mt-1 text-xs">
                                                {subtitleParts.join(" · ")}
                                            </div>
                                        )}
                                        <div className="text-text-muted mt-2 flex flex-wrap gap-4 text-xs">
                                            {p && (
                                                <>
                                                    <span>{p.shelf}</span>
                                                    <span>{p.aisle}</span>
                                                    <span className="capitalize">{p.type}</span>
                                                </>
                                            )}
                                            <span>
                                                Quantity:{" "}
                                                <span className="text-text-secondary font-semibold">
                                                    {reorder.quantity}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
