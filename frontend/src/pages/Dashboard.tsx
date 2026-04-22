import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import { apiAnalyzeShelf, type ShelfAnalysisResponse, type ShelfDetection } from "../api/query/shelfAnalysis";
import { useAuth } from "../hooks/useAuth";
import { apiMakeOutOfStockAlert } from "../api/query/alert";

const Dashboard = () => {
    const { user } = useAuth();
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState("");
    const [analysisError, setAnalysisError] = useState("");
    const [analysisResults, setAnalysisResults] = useState<Array<{ fileName: string; result: ShelfAnalysisResponse }>>(
        [],
    );
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const analysisResult = analysisResults[activeResultIndex]?.result ?? null;

    useEffect(() => {
        if (!imageDialogOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setImageDialogOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [imageDialogOpen]);
    const issueDetections = useMemo(() => {
        if (!analysisResult) return [];
        return analysisResult.detections.filter((d) => d.audit_status === "missing" || d.audit_status === "misplaced");
    }, [analysisResult]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        setSelectedImages(files);
        setAnalysisResults([]);
        setActiveResultIndex(0);
        setAnalysisError("");
        setAnalysisProgress("");
    };

    const handleAnalyzeShelf = async () => {
        if (selectedImages.length === 0) {
            setAnalysisError("Please upload at least one shelf image first.");
            return;
        }
        try {
            setAnalysisLoading(true);
            setAnalysisError("");
            setAnalysisProgress("");
            const successfulResults: Array<{ fileName: string; result: ShelfAnalysisResponse }> = [];
            const failedFiles: string[] = [];
            for (let i = 0; i < selectedImages.length; i += 1) {
                const imageFile = selectedImages[i];
                setAnalysisProgress(`Analyzing ${i + 1}/${selectedImages.length}: ${imageFile.name}`);
                try {
                    const result = await apiAnalyzeShelf(imageFile);
                    successfulResults.push({ fileName: imageFile.name, result });
                } catch {
                    failedFiles.push(imageFile.name);
                }
            }
            if (successfulResults.length === 0) throw new Error("None of the selected images could be analyzed.");
            setAnalysisResults(successfulResults);
            setActiveResultIndex(0);
            if (failedFiles.length > 0) {
                setAnalysisError(
                    `Processed ${successfulResults.length}/${selectedImages.length} images. Failed: ${failedFiles.join(", ")}`,
                );
            }
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : "Shelf analysis failed.");
        } finally {
            setAnalysisProgress("");
            setAnalysisLoading(false);
        }
    };

    return (
        <>
            <h1 className="mb-8 text-3xl font-semibold">Dashboard Overview</h1>

            {(user?.role === "manager" || user?.role === "supervisor") && (
                <button
                    className="bg-[var(--color-primary)] mb-4 rounded px-4 py-2 text-white hover:bg-blue-600"
                    onClick={async () => {
                        try {
                            await apiMakeOutOfStockAlert();
                        } catch (error) {
                            console.error("Error sending out of stock alert:", error);
                        }
                    }}
                >
                    Send Employees Alert
                </button>
            )}

            <div className="bg-surface mb-8 rounded-xl p-6 shadow">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">Shelf Analyzer</h2>
                        <p className="text-text-muted mt-1 text-sm">
                            Upload one or more shelf images to compare them against the planogram, mark empty slots, and
                            flag misplaced items.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(320px,360px),minmax(0,1fr)]">
                    {/* Upload panel */}
                    <div className="bg-surface-muted border-border space-y-4 rounded-2xl border p-5">
                        <h3 className="text-lg font-semibold">Upload</h3>
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="file:bg-[var(--color-primary)]/12 file:text-primary bg-surface border-border text-text-muted block w-full rounded-2xl border px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
                        />

                        {selectedImages.length > 0 && (
                            <p className="text-text-muted text-xs font-medium tracking-[0.14em] uppercase">
                                {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} selected
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleAnalyzeShelf}
                            disabled={selectedImages.length === 0 || analysisLoading}
                            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]-hover active:bg-[var(--color-primary)]-active w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {analysisLoading ? "Analyzing..." : "Analyze Shelf Images"}
                        </button>

                        {analysisProgress && (
                            <div className="bg-status-info-bg border-status-info-border text-status-info-text rounded-2xl border px-4 py-3 text-sm font-medium">
                                {analysisProgress}
                            </div>
                        )}

                        {analysisError && (
                            <div className="bg-status-missing-bg border-status-missing-border text-status-missing-text rounded-2xl border px-4 py-3 text-sm font-medium">
                                {analysisError}
                            </div>
                        )}

                        {analysisResult?.compliance_report && (
                            <div className="bg-surface border-border rounded-2xl border px-4 py-4">
                                <div className="text-text-muted text-xs font-semibold tracking-[0.18em] uppercase">
                                    Planogram Visibility
                                </div>
                                <div className="text-secondary mt-2 text-sm font-semibold">
                                    Rows visible in image: {analysisResult.compliance_report.visible_rows.length} of{" "}
                                    {analysisResult.compliance_report.total_planogram_rows} | Compliance:{" "}
                                    {analysisResult.compliance_report.compliance_score}%
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results panel */}
                    <div className="space-y-4">
                        {analysisResults.length > 1 && (
                            <div className="bg-surface border-border rounded-2xl border px-4 py-4">
                                <div className="text-text-muted mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
                                    Showing Result For
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysisResults.map((entry, index) => (
                                        <button
                                            key={`${entry.fileName}-${index}`}
                                            type="button"
                                            onClick={() => setActiveResultIndex(index)}
                                            className="rounded-full px-3 py-1 text-xs font-semibold"
                                            style={
                                                activeResultIndex === index
                                                    ? {
                                                        backgroundColor: "var(--color-text)",
                                                        color: "var(--color-background)",
                                                    }
                                                    : {
                                                        backgroundColor: "var(--color-surface-muted)",
                                                        color: "var(--color-text-secondary)",
                                                    }
                                            }
                                        >
                                            {entry.fileName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-surface border-border rounded-2xl border p-4">
                            {analysisResult ? (
                                <div className="space-y-4">
                                    <div className="text-text-muted flex flex-wrap gap-3 text-xs font-semibold tracking-[0.18em] uppercase">
                                        <span
                                            className="rounded-full px-3 py-1"
                                            style={{
                                                backgroundColor: "var(--color-status-missing-bg)",
                                                color: "var(--color-status-missing-text)",
                                            }}
                                        >
                                            M = Missing item
                                        </span>
                                        <span
                                            className="rounded-full px-3 py-1"
                                            style={{
                                                backgroundColor: "var(--color-status-misplaced-bg)",
                                                color: "var(--color-status-misplaced-text)",
                                            }}
                                        >
                                            W = Wrong product
                                        </span>
                                    </div>
                                    <img
                                        src={analysisResult.annotated_image}
                                        alt="Shelf analysis result"
                                        onClick={() => setImageDialogOpen(true)}
                                        className="bg-surface border-border w-full cursor-zoom-in rounded-2xl border object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="bg-surface border-border flex min-h-[340px] items-center justify-center rounded-2xl border border-dashed text-center">
                                    <div className="max-w-md px-6">
                                        <p className="text-lg font-semibold">No analysis yet</p>
                                        <p className="text-text-muted mt-2 text-sm leading-6">
                                            The annotated shelf image will appear here after you upload and analyze a
                                            shelf photo.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {analysisResult && (
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
                                    <div className="bg-status-success-bg border-status-success-border text-status-success-text rounded-2xl border px-4 py-4 text-sm font-medium">
                                        No missing or misplaced items were flagged in this audit.
                                    </div>
                                )}

                                <div className="mt-6 overflow-x-auto">
                                    <table className="w-full min-w-[900px] text-left text-sm">
                                        <thead>
                                            <tr className="border-border text-text-muted border-b">
                                                <th className="py-3">Marker</th>
                                                <th className="py-3">Slot</th>
                                                <th className="py-3">Status</th>
                                                <th className="py-3">Observed</th>
                                                <th className="py-3">Expected</th>
                                                <th className="py-3">Assignment</th>
                                                <th className="py-3">Match Score</th>
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
                        )}
                    </div>
                </div>
            </div>

            {imageDialogOpen && analysisResult && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setImageDialogOpen(false)}
                >
                    <div className="relative max-h-full max-w-full" onClick={(e: MouseEvent) => e.stopPropagation()}>
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

const formatSkuLine = (sku: ShelfDetection["sku"] | ShelfDetection["expected_sku"]) =>
    [sku?.brand, sku?.product_name, sku?.variant].filter(Boolean).join(" ");

const formatAssignmentMethod = (assignmentMethod?: ShelfDetection["assignment_method"]) =>
    assignmentMethod ? assignmentMethod.replace("_", " ") : "-";

const DetectionRow = ({ detection }: { detection: ShelfDetection }) => {
    const status = detection.audit_status || (detection.type === "empty_space" ? "missing" : "correct");
    const observed = formatSkuLine(detection.sku);
    const expected = formatSkuLine(detection.expected_sku);
    const assignmentMethod = formatAssignmentMethod(detection.assignment_method);
    const matchScore = (detection as ShelfDetection & { match_score?: number }).match_score;
    return (
        <tr
            className="border-border border-b"
            style={{
                backgroundColor:
                    status === "missing"
                        ? "var(--color-status-missing-bg)"
                        : status === "misplaced"
                            ? "var(--color-status-misplaced-bg)"
                            : status === "unverified"
                                ? "var(--color-status-info-bg)"
                                : undefined,
            }}
        >
            <td className="text-text-secondary py-3 font-semibold">{detection.issue_marker || "-"}</td>
            <td className="text-text-secondary py-3 font-medium">{detection.slot_id || "-"}</td>
            <td className="text-text-secondary py-3 font-medium capitalize">{status.replace("_", " ")}</td>
            <td className="text-text-muted py-3">{observed || "-"}</td>
            <td className="text-text-muted py-3">{expected || "-"}</td>
            <td className="text-text-muted py-3 capitalize">{assignmentMethod}</td>
            <td className="text-text-muted py-3">{typeof matchScore === "number" ? matchScore.toFixed(2) : "-"}</td>
        </tr>
    );
};

const IssueCard = ({ detection, reviewOnly = false }: { detection: ShelfDetection; reviewOnly?: boolean }) => {
    const status = detection.audit_status || (detection.type === "empty_space" ? "missing" : "correct");
    const observed = formatSkuLine(detection.sku);
    const expected = formatSkuLine(detection.expected_sku);
    const marker = detection.issue_marker || (reviewOnly ? "CHECK" : "ISSUE");
    const assignmentMethod = formatAssignmentMethod(detection.assignment_method);

    const badgeStyle: CSSProperties =
        status === "missing"
            ? { backgroundColor: "var(--color-status-missing-bg)", color: "var(--color-status-missing-text)" }
            : status === "misplaced"
                ? { backgroundColor: "var(--color-status-misplaced-bg)", color: "var(--color-status-misplaced-text)" }
                : { backgroundColor: "var(--color-status-info-bg)", color: "var(--color-status-info-text)" };

    return (
        <div
            className="border-border rounded-2xl border px-4 py-4"
            style={{
                backgroundColor:
                    status === "missing"
                        ? "var(--color-status-missing-bg)"
                        : status === "misplaced"
                            ? "var(--color-status-misplaced-bg)"
                            : status === "unverified"
                                ? "var(--color-status-info-bg)"
                                : undefined,
            }}
        >
            <div className="flex flex-wrap items-center gap-3">
                <span
                    className="rounded-full px-3 py-1 text-xs font-bold tracking-[0.18em]"
                    style={{ backgroundColor: "var(--color-text)", color: "var(--color-background)" }}
                >
                    {marker}
                </span>
                <span
                    className="rounded-full px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase"
                    style={badgeStyle}
                >
                    {status.replace("_", " ")}
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
