import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
    apiDeleteAnalysis,
    apiGetActiveJobs,
    apiGetAnalysisHistory,
    apiSubmitAnalysis,
} from "../api/query/shelfAnalysis";
import type { JobStatus, ShelfAnalysisResponse, ShelfDetection } from "../types/shelfAnalysis";
import { mockAnalysisResults } from "../assets/data/mockData";
import { PlusIcon } from "../_components/Icons";
import { shelfStatusClass, SHELF_STATUS_LABEL } from "../utils/constants";

type HistoryEntry = {
    id: number;
    fileName: string;
    result: ShelfAnalysisResponse;
    analyzedAt: Date;
};

type ActiveJob = {
    jobId: string;
    fileName: string;
    submittedAt: Date;
    status: JobStatus["status"];
    progress: number;
    etaSeconds: number | null;
    queuePosition: number | null;
};

const toHistoryEntries = (
    results: Array<{ id: number; fileName: string; result: ShelfAnalysisResponse }>,
): HistoryEntry[] => results.map((r, i) => ({ ...r, analyzedAt: new Date(Date.now() - i * 5 * 60_000) }));

const Dashboard = () => {
    const [searchParams] = useSearchParams();
    const log_id = searchParams.get("log_id");

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisError, setAnalysisError] = useState("");
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const tickRef = useRef<(() => Promise<void>) | null>(null);

    useEffect(() => {
        if (!log_id) return;
        const index = history.findIndex((entry) => entry.id === parseInt(log_id, 10));
        if (index !== -1) setSelectedIndex(index);
    }, [log_id, history]);

    const selectedEntry = selectedIndex !== null ? (history[selectedIndex] ?? null) : null;
    const analysisResult = selectedEntry?.result ?? null;

    const issueDetections = useMemo(() => {
        if (!analysisResult) return [];
        return analysisResult.detections.filter((d) => d.audit_status === "missing" || d.audit_status === "misplaced");
    }, [analysisResult]);

    useEffect(() => {
        let cancelled = false;
        setHistoryLoading(true);
        apiGetAnalysisHistory()
            .then((entries) => {
                if (cancelled) return;
                setHistory(
                    entries.length > 0
                        ? entries.map((e) => ({
                              id: e.id,
                              fileName: e.file_name,
                              result: e.result,
                              analyzedAt: new Date(e.created_at),
                          }))
                        : toHistoryEntries(mockAnalysisResults),
                );
            })
            .catch(() => {
                if (!cancelled) setHistory(toHistoryEntries(mockAnalysisResults));
            })
            .finally(() => {
                if (!cancelled) setHistoryLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const knownIds = new Set<string>();

        const tick = async () => {
            let active;
            try {
                active = await apiGetActiveJobs();
            } catch {
                return;
            }
            if (cancelled) return;

            const seenIds = new Set(active.map((j) => j.job_id));
            const completedIds = [...knownIds].filter((id) => !seenIds.has(id));

            knownIds.clear();
            seenIds.forEach((id) => knownIds.add(id));

            setActiveJobs(
                active.map((j) => ({
                    jobId: j.job_id,
                    fileName: j.file_name,
                    submittedAt: new Date(j.submitted_at * 1000),
                    status: j.status,
                    progress: j.progress,
                    etaSeconds: j.eta_seconds,
                    queuePosition: j.queue_position,
                })),
            );

            // Stop polling when nothing is in flight
            if (active.length === 0 && knownIds.size === 0) {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            }

            if (completedIds.length === 0) return;

            try {
                const entries = await apiGetAnalysisHistory();
                if (cancelled) return;
                setHistory(
                    entries.map((e) => ({
                        id: e.id,
                        fileName: e.file_name,
                        result: e.result,
                        analyzedAt: new Date(e.created_at),
                    })),
                );
                setSelectedIndex(0);
            } catch {
                // leave history as-is; the next tick will try again
            }
        };

        tickRef.current = tick;

        return () => {
            cancelled = true;
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            tickRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!imageDialogOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setImageDialogOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [imageDialogOpen]);

    useEffect(() => {
        if (!uploadDialogOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !analysisLoading) handleCloseUploadDialog();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [uploadDialogOpen, analysisLoading]);

    const handleCloseUploadDialog = () => {
        if (analysisLoading) return;
        setUploadDialogOpen(false);
        setSelectedImages([]);
        setAnalysisError("");
        setUploadProgress(0);
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        setSelectedImages(files);
        setAnalysisError("");
    };

    const handleDeleteSelected = async () => {
        if (selectedIndex === null || !selectedEntry) return;
        if (selectedEntry.id > 0) {
            try {
                await apiDeleteAnalysis(selectedEntry.id);
            } catch {
                return;
            }
        }
        setHistory((prev) => prev.filter((_, i) => i !== selectedIndex));
        setSelectedIndex(null);
    };

    const handleAnalyzeShelf = async () => {
        if (selectedImages.length === 0) {
            setAnalysisError("Please upload at least one shelf image first.");
            return;
        }
        try {
            setAnalysisLoading(true);
            setAnalysisError("");
            const submitted: ActiveJob[] = [];
            const failed: string[] = [];

            for (const imageFile of selectedImages) {
                setUploadProgress(0);
                try {
                    const { job_id, queue_position } = await apiSubmitAnalysis(imageFile, setUploadProgress);
                    submitted.push({
                        jobId: job_id,
                        fileName: imageFile.name,
                        submittedAt: new Date(),
                        status: "queued",
                        progress: 0,
                        etaSeconds: null,
                        queuePosition: queue_position,
                    });
                } catch {
                    failed.push(imageFile.name);
                }
            }

            if (submitted.length === 0) {
                throw new Error("Failed to submit any images for analysis.");
            }

            setActiveJobs((prev) => [...prev, ...submitted]);
            handleCloseUploadDialog();

            // Start polling if it was stopped
            if (!pollingRef.current && tickRef.current) {
                tickRef.current();
                pollingRef.current = setInterval(tickRef.current, 2000);
            }

            if (failed.length > 0) {
                setAnalysisError(`Failed to submit: ${failed.join(", ")}`);
            }
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : "Submission failed.");
        } finally {
            setAnalysisLoading(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="px-8 py-6">
            <header className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-semibold">Shelf Detection</h1>
                    <p className="text-text-muted mt-0.5 text-sm">
                        Upload shelf images to identify out-of-stock and misplaced items
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setUploadDialogOpen(true)}
                    className="hover:bg-primary-hover bg-primary inline-flex items-center gap-2 rounded-full px-2.5 py-2.5 text-sm font-semibold text-white transition-colors lg:rounded-xl lg:px-4"
                >
                    <PlusIcon />
                    <span className="hidden lg:block">New Analysis</span>
                </button>
            </header>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* ── History sidebar ── */}
                <div className="bg-surface w-full rounded-xl p-6 shadow lg:sticky lg:top-6 lg:w-80 lg:shrink-0 xl:w-96">
                    <h2 className="mb-4 text-xl font-semibold">Analysis History</h2>

                    {/* Active jobs */}
                    {activeJobs.length > 0 &&
                        (() => {
                            const runningJobs = activeJobs.filter((j) => j.status === "running");
                            const queuedJobs = activeJobs.filter((j) => j.status === "queued");
                            return (
                                <div className="mb-4 space-y-3">
                                    {queuedJobs.length > 0 && (
                                        <div>
                                            <p className="text-text-muted mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
                                                Waiting
                                            </p>
                                            <div className="space-y-2">
                                                {queuedJobs.map((job) => (
                                                    <ActiveJobCard key={job.jobId} job={job} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {runningJobs.length > 0 && (
                                        <div>
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase">
                                                    Processing
                                                </p>
                                                <span className="text-text-muted text-xs font-semibold">
                                                    {runningJobs.length} / 3
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {runningJobs.map((job) => (
                                                    <ActiveJobCard key={job.jobId} job={job} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {history.length > 0 && <div className="border-border mt-1 border-t" />}
                                </div>
                            );
                        })()}

                    {historyLoading ? (
                        <div className="border-border flex min-h-40 items-center justify-center rounded-2xl border border-dashed">
                            <p className="text-text-muted text-sm">Loading history...</p>
                        </div>
                    ) : history.length === 0 && activeJobs.length === 0 ? (
                        <div className="border-border flex min-h-40 items-center justify-center rounded-2xl border border-dashed text-center">
                            <div>
                                <p className="font-semibold">No analyses yet</p>
                                <p className="text-text-muted mt-1 text-sm">Click "+ New Analysis" to get started.</p>
                            </div>
                        </div>
                    ) : history.length > 0 ? (
                        <div className="no-scrollbar max-h-[60vh] space-y-2 overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
                            {history.map((entry, index) => (
                                <HistoryCard
                                    key={`${entry.fileName}-${entry.analyzedAt.getTime()}`}
                                    entry={entry}
                                    selected={selectedIndex === index}
                                    onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* ── Detail panel ── */}
                <div className="min-w-0 flex-1">
                    {selectedEntry ? (
                        <div className="bg-surface rounded-xl p-6 shadow">
                            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold">{selectedEntry.fileName}</h2>
                                    <p className="text-text-muted mt-1 text-sm">
                                        Analyzed at{" "}
                                        {selectedEntry.analyzedAt.toLocaleString([], {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleDeleteSelected}
                                        className="text-status-missing-text hover:bg-status-missing-bg rounded-xl px-3 py-1.5 text-sm font-semibold transition"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIndex(null)}
                                        className="text-text-muted hover:text-text text-sm font-semibold"
                                    >
                                        Close ✕
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-surface border-border rounded-2xl border p-4">
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-3 text-xs font-semibold tracking-[0.18em] uppercase">
                                            <span className="bg-status-missing-bg text-status-missing-text rounded-full px-3 py-1">
                                                M = Missing item
                                            </span>
                                            <span className="bg-status-misplaced-bg text-status-misplaced-text rounded-full px-3 py-1">
                                                W = Wrong product
                                            </span>
                                        </div>
                                        <img
                                            src={analysisResult!.annotated_image}
                                            alt="Shelf analysis result"
                                            onClick={() => setImageDialogOpen(true)}
                                            className="bg-surface border-border w-full cursor-zoom-in rounded-2xl border object-contain"
                                        />
                                    </div>
                                </div>

                                {analysisResult!.compliance_report && (
                                    <div className="bg-surface border-border rounded-2xl border px-4 py-4">
                                        <div className="text-text-muted text-xs font-semibold tracking-[0.18em] uppercase">
                                            Planogram Visibility
                                        </div>
                                        <div className="text-secondary mt-2 text-sm font-semibold">
                                            Rows visible: {analysisResult!.compliance_report.visible_rows.length} of{" "}
                                            {analysisResult!.compliance_report.total_planogram_rows} | Compliance:{" "}
                                            {analysisResult!.compliance_report.compliance_score}%
                                        </div>
                                    </div>
                                )}

                                <div className="bg-surface border-border rounded-2xl border p-4 shadow-sm">
                                    <h3 className="mb-4 text-lg font-semibold">What Needs Attention</h3>
                                    {issueDetections.length > 0 ? (
                                        <div className="space-y-3">
                                            {issueDetections.map((detection, index) => (
                                                <IssueCard
                                                    key={`${detection.issue_marker ?? "issue"}-${index}-${detection.bbox.join("-")}`}
                                                    detection={detection}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="border-status-success-bg bg-status-success-bg text-status-success-text rounded-2xl border px-4 py-4 text-sm font-medium">
                                            No missing or misplaced items were flagged in this audit.
                                        </div>
                                    )}

                                    <div className="mt-6 overflow-x-auto">
                                        <table className="w-full min-w-225 text-left text-sm">
                                            <thead>
                                                <tr className="border-border text-text-muted border-b">
                                                    <th className="p-3 text-center">Marker</th>
                                                    <th className="p-3">Slot</th>
                                                    <th className="p-3">Status</th>
                                                    <th className="p-3">Observed</th>
                                                    <th className="p-3">Expected</th>
                                                    <th className="p-3">Assignment</th>
                                                    <th className="p-3">Match Score</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {issueDetections.map((detection, index) => (
                                                    <DetectionRow
                                                        key={`${detection.issue_marker ?? detection.slot_id ?? "row"}-${index}`}
                                                        detection={detection}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface flex min-h-64 items-center justify-center rounded-xl p-6 shadow">
                            <div className="text-center">
                                <p className="text-text-secondary font-semibold">No analysis selected</p>
                                <p className="text-text-muted mt-1 text-sm">
                                    Choose an entry from the history to view its results.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {uploadDialogOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onClick={handleCloseUploadDialog}
                >
                    <div
                        className="bg-surface w-full max-w-md rounded-2xl p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">New Shelf Analysis</h2>
                            <button
                                onClick={handleCloseUploadDialog}
                                disabled={analysisLoading}
                                className="text-text-muted hover:text-text disabled:opacity-40"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-text-muted text-sm">
                                Upload one or more shelf images to compare against the planogram, mark empty slots, and
                                flag misplaced items.
                            </p>
                            <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                onChange={handleFileChange}
                                disabled={analysisLoading}
                                className="file:bg-primary/12 file:text-primary bg-surface-muted border-border text-text-muted block w-full rounded-2xl border px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold disabled:opacity-50"
                            />
                            {selectedImages.length > 0 && (
                                <p className="text-text-muted text-xs font-medium tracking-[0.14em] uppercase">
                                    {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} selected
                                </p>
                            )}
                            {analysisLoading && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-semibold">
                                        <span className="text-text-secondary">
                                            {uploadProgress < 100 ? "Uploading" : "Queuing"}
                                        </span>
                                        <span className="text-text-muted">{uploadProgress}%</span>
                                    </div>
                                    <div className="bg-surface-muted h-2 w-full overflow-hidden rounded-full">
                                        <div
                                            className="bg-status-info-text h-full rounded-full transition-all duration-200 ease-out"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-text-muted text-xs">
                                        {uploadProgress < 100
                                            ? "Sending image to server..."
                                            : "Queued — analysis will begin shortly..."}
                                    </p>
                                </div>
                            )}
                            {analysisError && (
                                <div className="border-status-missing-bg bg-status-missing-bg text-status-missing-text rounded-2xl border px-4 py-3 text-sm font-medium">
                                    {analysisError}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseUploadDialog}
                                    disabled={analysisLoading}
                                    className="bg-surface-muted text-text-secondary flex-1 rounded-2xl px-4 py-3 font-semibold transition disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAnalyzeShelf}
                                    disabled={selectedImages.length === 0 || analysisLoading}
                                    className="bg-primary flex-1 rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {analysisLoading
                                        ? uploadProgress < 100
                                            ? "Uploading..."
                                            : "Queuing..."
                                        : "Analyze"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {imageDialogOpen && analysisResult && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setImageDialogOpen(false)}
                >
                    <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setImageDialogOpen(false)}
                            className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-gray-100"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                        <img
                            src={analysisResult.annotated_image}
                            alt="Shelf analysis result (full size)"
                            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const formatEta = (seconds: number): string => {
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s left`;
    return `${Math.round(seconds)}s left`;
};

const ActiveJobCard = ({ job }: { job: ActiveJob }) => (
    <div className="border-border rounded-2xl border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
            <span className="text-text-secondary truncate text-sm font-semibold">{job.fileName}</span>
            {job.status === "queued" ? (
                <span className="bg-surface-muted text-text-muted shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Queue #{job.queuePosition ?? "…"}
                </span>
            ) : (
                <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Analyzing
                </span>
            )}
        </div>
        {job.status === "running" && (
            <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-text-muted">{job.progress}%</span>
                    {job.etaSeconds != null && <span className="text-text-muted">{formatEta(job.etaSeconds)}</span>}
                </div>
                <div className="bg-surface-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                        className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${job.progress}%` }}
                    />
                </div>
            </div>
        )}
        {job.status === "queued" && (
            <div className="mt-2">
                <div className="bg-surface-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div className="bg-surface-muted from-surface-muted via-text-muted/30 to-surface-muted h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r" />
                </div>
            </div>
        )}
    </div>
);

const complianceTextClass = (score: number) =>
    score >= 90 ? "text-status-success-text" : score >= 70 ? "text-status-misplaced-text" : "text-status-missing-text";

const HistoryCard = ({ entry, selected, onClick }: { entry: HistoryEntry; selected: boolean; onClick: () => void }) => {
    const { result, analyzedAt } = entry;
    const issueCount = (result.summary.missing_count ?? 0) + (result.summary.misplaced_count ?? 0);
    const compliance = result.compliance_report?.compliance_score;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`hover:bg-surface-muted w-full rounded-2xl border px-5 py-4 text-left transition ${selected ? "bg-surface-muted border-text" : "border-border"}`}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{entry.fileName}</span>
                    {selected && (
                        <span className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase">
                            Viewing
                        </span>
                    )}
                </div>
                <div className="text-text-muted flex flex-wrap items-center gap-4 text-xs font-semibold">
                    {compliance !== undefined && (
                        <span className={complianceTextClass(compliance)}>{compliance}% compliance</span>
                    )}
                    {issueCount > 0 ? (
                        <span className="text-status-missing-text">
                            {issueCount} issue{issueCount === 1 ? "" : "s"}
                        </span>
                    ) : (
                        <span className="text-status-success-text">No issues</span>
                    )}
                    <span>{analyzedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
            </div>
        </button>
    );
};

const formatSkuLine = (sku: ShelfDetection["sku"] | ShelfDetection["expected_sku"]) =>
    [sku?.brand, sku?.product_name, sku?.variant].filter(Boolean).join(" ");

const formatAssignmentMethod = (assignmentMethod?: ShelfDetection["assignment_method"]) =>
    assignmentMethod ? assignmentMethod.replace("_", " ") : "-";

const detectionRowBg = (status: string) => {
    switch (status) {
        case "missing":
            return "bg-status-missing-bg";
        case "misplaced":
            return "bg-status-misplaced-bg";
        case "unverified":
            return "bg-status-info-bg";
        default:
            return "";
    }
};

const DetectionRow = ({ detection }: { detection: ShelfDetection }) => {
    const status = detection.audit_status || (detection.type === "empty_space" ? "missing" : "correct");
    const observed = formatSkuLine(detection.sku);
    const expected = formatSkuLine(detection.expected_sku);
    const assignmentMethod = formatAssignmentMethod(detection.assignment_method);
    const matchScore = (detection as ShelfDetection & { match_score?: number }).match_score;

    return (
        <tr className={`border-border border-b ${detectionRowBg(status)}`}>
            <td className="text-text-secondary py-3 text-center">{detection.issue_marker || "-"}</td>
            <td className="text-text-secondary p-3 font-medium">{detection.slot_id || "-"}</td>
            <td className="text-text-secondary p-3 font-medium capitalize">{status.replace("_", " ")}</td>
            <td className="text-text-muted p-3">{observed || "-"}</td>
            <td className="text-text-muted p-3">{expected || "-"}</td>
            <td className="text-text-muted p-3 capitalize">{assignmentMethod}</td>
            <td className="text-text-muted py-3 text-center">
                {typeof matchScore === "number" ? matchScore.toFixed(2) : "-"}
            </td>
        </tr>
    );
};

const IssueCard = ({ detection, reviewOnly = false }: { detection: ShelfDetection; reviewOnly?: boolean }) => {
    const status = detection.audit_status || (detection.type === "empty_space" ? "missing" : "correct");
    const observed = formatSkuLine(detection.sku);
    const expected = formatSkuLine(detection.expected_sku);
    const marker = detection.issue_marker || (reviewOnly ? "CHECK" : "ISSUE");
    const assignmentMethod = formatAssignmentMethod(detection.assignment_method);

    const badgeClass =
        status === "missing" || status === "misplaced"
            ? shelfStatusClass(status)
            : "bg-status-info-bg text-status-info-text";

    return (
        <div className={`border-border rounded-2xl border px-4 py-4 ${detectionRowBg(status)}`}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="bg-text text-background rounded-full px-3 py-1 text-xs font-bold tracking-[0.18em]">
                    {marker}
                </span>
                <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase ${badgeClass}`}
                >
                    {SHELF_STATUS_LABEL[status as keyof typeof SHELF_STATUS_LABEL] ?? status.replace("_", " ")}
                </span>
                <span className="text-text-secondary text-sm font-semibold">{detection.slot_id || "Unknown slot"}</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="bg-surface-muted rounded-2xl px-4 py-3">
                    <div className="text-text-muted text-xs font-semibold tracking-[0.16em] uppercase">Observed</div>
                    <div className="text-text-secondary mt-1 text-sm font-medium">
                        {observed || "No confirmed product"}
                    </div>
                </div>
                <div className="bg-surface-muted rounded-2xl px-4 py-3">
                    <div className="text-text-muted text-xs font-semibold tracking-[0.16em] uppercase">Expected</div>
                    <div className="text-text-secondary mt-1 text-sm font-medium">
                        {expected || "No expected product"}
                    </div>
                </div>
            </div>

            <div className="text-text-muted mt-3 text-xs font-semibold tracking-[0.16em] uppercase">
                Assignment Method: <span className="text-text-secondary">{assignmentMethod}</span>
            </div>
        </div>
    );
};

export default Dashboard;
