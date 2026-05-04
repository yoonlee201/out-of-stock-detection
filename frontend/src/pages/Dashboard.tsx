import { useMemo, useState, type ChangeEvent } from "react";
import Sidebar from "../_components/Sidebar";
import { apiAnalyzeShelf, type ShelfAnalysisResponse, type ShelfDetection } from "../api/query/shelfAnalysis";
import { useAuth } from "../hooks/useAuth";
import { apiMakeOutOfStockAlert } from "../api/query/alert";
import { apiExportProductsCSV } from "../api/query/products";

const Dashboard = () => {
    const { user } = useAuth();
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [queueStatus, setQueueStatus] = useState<{ current: number; total: number; fileName: string } | null>(null);
    const [analysisError, setAnalysisError] = useState("");
    const [analysisResults, setAnalysisResults] = useState<Array<{ fileName: string; result: ShelfAnalysisResponse }>>([]);
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const analysisResult = analysisResults[activeResultIndex]?.result ?? null;
    const issueDetections = useMemo(() => {
        if (!analysisResult) {
            return [];
        }

        return analysisResult.detections.filter((detection) =>
            detection.audit_status === "missing" || detection.audit_status === "misplaced"
        );
    }, [analysisResult]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        setSelectedImages(files);
        setAnalysisResults([]);
        setActiveResultIndex(0);
        setAnalysisError("");
        setQueueStatus(null);
    };

    const handleAnalyzeShelf = async () => {
        if (selectedImages.length === 0) {
            setAnalysisError("Please upload at least one shelf image first.");
            return;
        }

        try {
            setAnalysisLoading(true);
            setAnalysisError("");
            setQueueStatus(null);

            const successfulResults: Array<{ fileName: string; result: ShelfAnalysisResponse }> = [];
            const failedFiles: string[] = [];

            for (let index = 0; index < selectedImages.length; index += 1) {
                const imageFile = selectedImages[index];
                setQueueStatus({ current: index + 1, total: selectedImages.length, fileName: imageFile.name });

                try {
                    const result = await apiAnalyzeShelf(imageFile);
                    successfulResults.push({ fileName: imageFile.name, result });
                } catch {
                    failedFiles.push(imageFile.name);
                }
            }

            if (successfulResults.length === 0) {
                throw new Error("None of the selected images could be analyzed.");
            }

            setAnalysisResults(successfulResults);
            setActiveResultIndex(0);

            if (failedFiles.length > 0) {
                setAnalysisError(
                    `Processed ${successfulResults.length}/${selectedImages.length} images. Failed: ${failedFiles.join(", ")}`
                );
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Shelf analysis failed.";
            setAnalysisError(message);
        } finally {
            setQueueStatus(null);
            setAnalysisLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex-1 overflow-y-auto p-8">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-3xl font-semibold">Dashboard Overview</h1>
                    <div className="flex flex-wrap gap-2">
                        {(user?.role === "manager" || user?.role === "supervisor") && (
                            <button
                                className="bg-secondary rounded px-4 py-2 text-white hover:bg-blue-600"
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
                        <button
                            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={async () => {
                                try {
                                    await apiExportProductsCSV();
                                } catch (error) {
                                    console.error("Error exporting CSV:", error);
                                }
                            }}
                        >
                            Export Inventory CSV
                        </button>
                    </div>
                </div>

                <div className="mb-8 rounded-xl bg-white p-6 shadow">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">Shelf Analyzer</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Upload one or more shelf images to compare them against the planogram, mark empty slots, and flag misplaced items.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(320px,360px),minmax(0,1fr)]">
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <h3 className="text-lg font-semibold text-slate-800">Upload</h3>
                            <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                onChange={handleFileChange}
                                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-secondary/12 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-secondary"
                            />

                            {selectedImages.length > 0 && (
                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                                    {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} selected
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={handleAnalyzeShelf}
                                disabled={selectedImages.length === 0 || analysisLoading}
                                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-active w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                {analysisLoading ? "Analyzing..." : "Analyze Shelf Images"}
                            </button>

                            {queueStatus && (
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-blue-700">
                                        <span>Processing queue</span>
                                        <span>{queueStatus.current}/{queueStatus.total} images</span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200">
                                        <div
                                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                            style={{ width: `${(queueStatus.current / queueStatus.total) * 100}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 truncate text-xs text-blue-600">{queueStatus.fileName}</p>
                                </div>
                            )}

                            {analysisError && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                    {analysisError}
                                </div>
                            )}

                            {analysisResult?.compliance_report && (
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planogram Visibility</div>
                                    <div className="mt-2 text-sm font-semibold text-slate-700">
                                        Rows visible in image: {analysisResult.compliance_report.visible_rows.length} of{" "}
                                        {analysisResult.compliance_report.total_planogram_rows} | Compliance:{" "}
                                        {analysisResult.compliance_report.compliance_score}%
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {analysisResults.length > 1 && (
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Showing Result For</div>
                                    <div className="flex flex-wrap gap-2">
                                        {analysisResults.map((entry, index) => (
                                            <button
                                                key={`${entry.fileName}-${index}`}
                                                type="button"
                                                onClick={() => setActiveResultIndex(index)}
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    activeResultIndex === index
                                                        ? "bg-slate-900 text-white"
                                                        : "bg-slate-100 text-slate-700"
                                                }`}
                                            >
                                                {entry.fileName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                {analysisResult ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">M = Missing item</span>
                                            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">W = Wrong product</span>
                                        </div>

                                        <img
                                            src={analysisResult.annotated_image}
                                            alt="Shelf analysis result"
                                            className="w-full rounded-2xl border border-slate-200 bg-white object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex min-h-[340px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-slate-500">
                                        <div className="max-w-md px-6">
                                            <p className="text-lg font-semibold text-slate-700">No analysis yet</p>
                                            <p className="mt-2 text-sm leading-6">
                                                The annotated shelf image will appear here after you upload and analyze a shelf photo.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {analysisResult && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
                                            No missing or misplaced items were flagged in this audit.
                                        </div>
                                    )}

                                    <div className="mt-6 overflow-x-auto">
                                        <table className="w-full min-w-[900px] text-left text-sm">
                                            <thead>
                                                <tr className="border-b text-slate-500">
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
            </div>
        </div>
    );
};

const formatSkuLine = (sku: ShelfDetection["sku"] | ShelfDetection["expected_sku"]) =>
    [sku?.brand, sku?.product_name, sku?.variant].filter(Boolean).join(" ");

const formatAssignmentMethod = (assignmentMethod?: ShelfDetection["assignment_method"]) => {
    if (!assignmentMethod) {
        return "-";
    }

    return assignmentMethod.replace("_", " ");
};

const statusTone = (status: string) =>
    status === "missing"
        ? "bg-rose-50"
        : status === "misplaced"
          ? "bg-amber-50"
          : status === "unverified"
            ? "bg-blue-50"
            : "hover:bg-gray-50";

const DetectionRow = ({ detection }: { detection: ShelfDetection }) => {
    const status = detection.audit_status || (detection.type === "empty_space" ? "missing" : "correct");
    const observed = formatSkuLine(detection.sku);
    const expected = formatSkuLine(detection.expected_sku);
    const assignmentMethod = formatAssignmentMethod(detection.assignment_method);
    const matchScore = (detection as ShelfDetection & { match_score?: number }).match_score;

    return (
        <tr className={`border-b ${statusTone(status)}`}>
            <td className="py-3 font-semibold text-slate-700">{detection.issue_marker || "-"}</td>
            <td className="py-3 font-medium text-slate-700">{detection.slot_id || "-"}</td>
            <td className="py-3 font-medium capitalize text-slate-700">{status.replace("_", " ")}</td>
            <td className="py-3 text-slate-600">{observed || "-"}</td>
            <td className="py-3 text-slate-600">{expected || "-"}</td>
            <td className="py-3 text-slate-600 capitalize">{assignmentMethod}</td>
            <td className="py-3 text-slate-600">
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
    const badgeTone =
        status === "missing"
            ? "bg-rose-100 text-rose-700"
            : status === "misplaced"
              ? "bg-amber-100 text-amber-700"
              : "bg-blue-100 text-blue-700";

    return (
        <div className={`rounded-2xl border border-slate-200 px-4 py-4 ${statusTone(status)}`}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold tracking-[0.18em] text-white">
                    {marker}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${badgeTone}`}>
                    {status.replace("_", " ")}
                </span>
                <span className="text-sm font-semibold text-slate-700">{detection.slot_id || "Unknown slot"}</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Observed</div>
                    <div className="mt-1 text-sm font-medium text-slate-700">{observed || "No confirmed product"}</div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expected</div>
                    <div className="mt-1 text-sm font-medium text-slate-700">{expected || "No expected product"}</div>
                </div>
            </div>

            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Assignment Method: <span className="text-slate-700">{assignmentMethod}</span>
            </div>
        </div>
    );
};

export default Dashboard;
