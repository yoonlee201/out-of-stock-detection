import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { apiAnalyzeShelf, apiGetAnalysisHistory, type ShelfAnalysisResponse, type ShelfDetection } from "../api/query/shelfAnalysis";
import { mockAnalysisResults } from "../mockData";
import { PlusIcon } from "../_components/Icons";
import { shelfStatusClass, SHELF_STATUS_LABEL } from "../utils/constants";

interface HistoryEntry {
    fileName: string;
    result: ShelfAnalysisResponse;
    analyzedAt: Date;
}

const toHistoryEntries = (results: Array<{ fileName: string; result: ShelfAnalysisResponse }>): HistoryEntry[] =>
    results.map((r, i) => ({ ...r, analyzedAt: new Date(Date.now() - i * 5 * 60_000) }));

const Dashboard = () => {
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [progressPhase, setProgressPhase] = useState<"uploading" | "analyzing" | "idle">("idle");
    const [progressValue, setProgressValue] = useState(0);
    const [analysisError, setAnalysisError] = useState("");
    const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [imageDialogOpen, setImageDialogOpen] = useState(false);

    const selectedEntry = selectedIndex !== null ? (history[selectedIndex] ?? null) : null;
    const analysisResult = selectedEntry?.result ?? null;

    const issueDetections = useMemo(() => {
        if (!analysisResult) return [];
        return analysisResult.detections.filter((d) => d.audit_status === "missing" || d.audit_status === "misplaced");
    }, [analysisResult]);

    // Load history from backend; fall back to mock data in dev if unavailable
    useEffect(() => {
        let cancelled = false;
        setHistoryLoading(true);
        apiGetAnalysisHistory()
            .then((entries) => {
                if (cancelled) return;
                if (entries.length > 0) {
                    setHistory(entries.map((e) => ({
                        fileName: e.file_name,
                        result: e.result,
                        analyzedAt: new Date(e.created_at),
                    })));
                } else {
                    setHistory(toHistoryEntries(mockAnalysisResults));
                }
            })
            .catch(() => {
                if (!cancelled) setHistory(toHistoryEntries(mockAnalysisResults));
            })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });
        return () => { cancelled = true; };
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
            if (e.key === "Escape" && !analysisLoading) {
                setUploadDialogOpen(false);
                setSelectedImages([]);
                setAnalysisError("");
                setProgressPhase("idle");
                setProgressValue(0);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [uploadDialogOpen, analysisLoading]);

    const handleCloseUploadDialog = () => {
        if (analysisLoading) return;
        setUploadDialogOpen(false);
        setSelectedImages([]);
        setAnalysisError("");
        setProgressPhase("idle");
        setProgressValue(0);
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        setSelectedImages(files);
        setAnalysisError("");
    };

    const stopSim = () => {
        if (simRef.current) {
            clearInterval(simRef.current);
            simRef.current = null;
        }
    };

    const startAnalysisSim = () => {
        setProgressPhase("analyzing");
        setProgressValue(0);
        let v = 0;
        simRef.current = setInterval(() => {
            v += (90 - v) * 0.06 + 0.4;
            if (v >= 90) v = 90;
            setProgressValue(Math.round(v));
        }, 250);
    };

    const handleAnalyzeShelf = async () => {
        if (selectedImages.length === 0) {
            setAnalysisError("Please upload at least one shelf image first.");
            return;
        }
        try {
            setAnalysisLoading(true);
            setAnalysisError("");
            const newEntries: HistoryEntry[] = [];
            const failedFiles: string[] = [];
            for (let i = 0; i < selectedImages.length; i += 1) {
                const imageFile = selectedImages[i];
                let analysisStarted = false;
                setProgressPhase("uploading");
                setProgressValue(0);
                try {
                    const result = await apiAnalyzeShelf(imageFile, (percent) => {
                        if (!analysisStarted) {
                            setProgressValue(percent);
                            if (percent >= 100) {
                                analysisStarted = true;
                                startAnalysisSim();
                            }
                        }
                    });
                    stopSim();
                    setProgressValue(100);
                    newEntries.push({ fileName: imageFile.name, result, analyzedAt: new Date() });
                } catch {
                    stopSim();
                    failedFiles.push(imageFile.name);
                }
            }
            if (newEntries.length === 0) throw new Error("None of the selected images could be analyzed.");
            setHistory((prev) => [...newEntries, ...prev]);
            setSelectedIndex(0);
            handleCloseUploadDialog();
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : "Shelf analysis failed.");
        } finally {
            stopSim();
            setProgressPhase("idle");
            setAnalysisLoading(false);
        }
    };

    return (
        <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-semibold">Dashboard</h1>
                <button
                    type="button"
                    onClick={() => setUploadDialogOpen(true)}
                    className="hover:bg-primary-hover bg-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                >

                    <PlusIcon /> New Analysis
                </button>
            </div>

            {/* History list */}
            <div className="bg-surface mb-6 rounded-xl p-6 shadow">
                <h2 className="mb-4 text-xl font-semibold">Analysis History</h2>
                {historyLoading ? (
                    <div className="border-border flex min-h-50 items-center justify-center rounded-2xl border border-dashed">
                        <p className="text-text-muted text-sm">Loading history...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="border-border flex min-h-50 items-center justify-center rounded-2xl border border-dashed text-center">
                        <div>
                            <p className="font-semibold">No analyses yet</p>
                            <p className="text-text-muted mt-1 text-sm">Click "+ New Analysis" to get started.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {history.map((entry, index) => (
                            <HistoryCard
                                key={`${entry.fileName}-${entry.analyzedAt.getTime()}`}
                                entry={entry}
                                selected={selectedIndex === index}
                                onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Detail panel */}
            {selectedEntry && (
                <div className="bg-surface mb-8 rounded-xl p-6 shadow">
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
                        <button
                            type="button"
                            onClick={() => setSelectedIndex(null)}
                            className="text-text-muted hover:text-text text-sm font-semibold"
                        >
                            Close ✕
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Annotated image */}
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

                        {/* Compliance summary */}
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

                        {/* Issue cards + table */}
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
            )}

            {/* Upload dialog */}
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
                            {progressPhase !== "idle" && <ProgressBar phase={progressPhase} value={progressValue} />}
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
                                    {analysisLoading ? "Analyzing..." : "Analyze"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full-size image dialog */}
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
        </>
    );
};

const ProgressBar = ({ phase, value }: { phase: "uploading" | "analyzing"; value: number }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-text-secondary capitalize">{phase === "uploading" ? "Uploading" : "Analyzing"}</span>
            <span className="text-text-muted">{value}%</span>
        </div>
        <div className="bg-surface-muted h-2 w-full overflow-hidden rounded-full">
            <div
                className={`h-full rounded-full transition-all duration-200 ease-out ${phase === "uploading" ? "bg-status-info-text" : "bg-primary"}`}
                style={{ width: `${value}%` }}
            />
        </div>
        <p className="text-text-muted text-xs">
            {phase === "uploading" ? "Sending image to server..." : "Server is analyzing the shelf..."}
        </p>
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
            className={`hover:bg-surface-muted w-full rounded-2xl border px-5 py-4 text-left transition ${
                selected ? "bg-surface-muted border-text" : "border-border"
            }`}
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

    // Reuse shelfStatusClass from constants for the badge — status values align (missing/misplaced)
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
