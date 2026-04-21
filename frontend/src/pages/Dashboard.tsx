import { useMemo, useState, type ChangeEvent } from "react";
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
    const analysisResult = analysisResults[activeResultIndex]?.result ?? null;
    const issueDetections = useMemo(() => {
        if (!analysisResult) {
            return [];
        }

        return analysisResult.detections.filter(
            (detection) => detection.audit_status === "missing" || detection.audit_status === "misplaced",
        );
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

            for (let index = 0; index < selectedImages.length; index += 1) {
                const imageFile = selectedImages[index];
                setAnalysisProgress(`Analyzing ${index + 1}/${selectedImages.length}: ${imageFile.name}`);

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
                    `Processed ${successfulResults.length}/${selectedImages.length} images. Failed: ${failedFiles.join(", ")}`,
                );
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Shelf analysis failed.";
            setAnalysisError(message);
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
                    className="bg-primary mb-4 rounded px-4 py-2 text-white hover:bg-blue-600"
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

            <div className="mb-8 rounded-xl bg-white p-6 shadow dark:bg-gray-800 dark:shadow-gray-900/50">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">Shelf Analyzer</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Upload one or more shelf images to compare them against the planogram, mark empty slots, and
                            flag misplaced items.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(320px,360px),minmax(0,1fr)]">
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-gray-600 dark:bg-gray-700/50">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Upload</h3>
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="file:bg-primary/12 file:text-primary block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-slate-300"
                        />

                        {selectedImages.length > 0 && (
                            <p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                                {selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} selected
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleAnalyzeShelf}
                            disabled={selectedImages.length === 0 || analysisLoading}
                            className="bg-primary hover:bg-primary-hover active:bg-primary-active w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {analysisLoading ? "Analyzing..." : "Analyze Shelf Images"}
                        </button>

                        {analysisProgress && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                {analysisProgress}
                            </div>
                        )}

                        {analysisError && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                                {analysisError}
                            </div>
                        )}

                        {analysisResult?.compliance_report && (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-gray-600 dark:bg-gray-700">
                                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                                    Planogram Visibility
                                </div>
                                <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Rows visible in image: {analysisResult.compliance_report.visible_rows.length} of{" "}
                                    {analysisResult.compliance_report.total_planogram_rows} | Compliance:{" "}
                                    {analysisResult.compliance_report.compliance_score}%
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {analysisResults.length > 1 && (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-gray-600 dark:bg-gray-700">
                                <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                                    Showing Result For
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysisResults.map((entry, index) => (
                                        <button
                                            key={`${entry.fileName}-${index}`}
                                            type="button"
                                            onClick={() => setActiveResultIndex(index)}
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                activeResultIndex === index
                                                    ? "bg-slate-900 text-white dark:bg-white dark:text-gray-900"
                                                    : "bg-slate-100 text-slate-700 dark:bg-gray-600 dark:text-slate-200"
                                            }`}
                                        >
                                            {entry.fileName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                            {analysisResult ? (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-3 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                                        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                                            M = Missing item
                                        </span>
                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                            W = Wrong product
                                        </span>
                                    </div>

                                    <img
                                        src={analysisResult.annotated_image}
                                        alt="Shelf analysis result"
                                        className="w-full rounded-2xl border border-slate-200 bg-white object-contain dark:border-gray-600 dark:bg-gray-700"
                                    />
                                </div>
                            ) : (
                                <div className="flex min-h-[340px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-slate-500 dark:border-gray-600 dark:bg-gray-700 dark:text-slate-400">
                                    <div className="max-w-md px-6">
                                        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                                            No analysis yet
                                        </p>
                                        <p className="mt-2 text-sm leading-6">
                                            The annotated shelf image will appear here after you upload and analyze a
                                            shelf photo.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {analysisResult && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:shadow-gray-900/30">
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
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                                        No missing or misplaced items were flagged in this audit.
                                    </div>
                                )}

                                <div className="mt-6 overflow-x-auto">
                                    <table className="w-full min-w-[900px] text-left text-sm">
                                        <thead>
                                            <tr className="border-b text-slate-500 dark:border-gray-600 dark:text-slate-400">
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
        </>
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
        ? "bg-rose-50 dark:bg-rose-900/20"
        : status === "misplaced"
          ? "bg-amber-50 dark:bg-amber-900/20"
          : status === "unverified"
            ? "bg-blue-50 dark:bg-blue-900/20"
            : "hover:bg-gray-50 dark:hover:bg-gray-700/50";

const DetectionRow = ({ detection }: { detection: ShelfDetection }) => {
    const status = detection.audit_status || (detection.type === "empty_space" ? "missing" : "correct");
    const observed = formatSkuLine(detection.sku);
    const expected = formatSkuLine(detection.expected_sku);
    const assignmentMethod = formatAssignmentMethod(detection.assignment_method);
    const matchScore = (detection as ShelfDetection & { match_score?: number }).match_score;

    return (
        <tr className={`border-b dark:border-gray-600 ${statusTone(status)}`}>
            <td className="py-3 font-semibold text-slate-700 dark:text-slate-200">{detection.issue_marker || "-"}</td>
            <td className="py-3 font-medium text-slate-700 dark:text-slate-200">{detection.slot_id || "-"}</td>
            <td className="py-3 font-medium text-slate-700 capitalize dark:text-slate-200">
                {status.replace("_", " ")}
            </td>
            <td className="py-3 text-slate-600 dark:text-slate-300">{observed || "-"}</td>
            <td className="py-3 text-slate-600 dark:text-slate-300">{expected || "-"}</td>
            <td className="py-3 text-slate-600 capitalize dark:text-slate-300">{assignmentMethod}</td>
            <td className="py-3 text-slate-600 dark:text-slate-300">
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
            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
            : status === "misplaced"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

    return (
        <div className={`rounded-2xl border border-slate-200 px-4 py-4 dark:border-gray-600 ${statusTone(status)}`}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold tracking-[0.18em] text-white dark:bg-white dark:text-gray-900">
                    {marker}
                </span>
                <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase ${badgeTone}`}
                >
                    {status.replace("_", " ")}
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {detection.slot_id || "Unknown slot"}
                </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-gray-700/80">
                    <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                        Observed
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        {observed || "No confirmed product"}
                    </div>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-gray-700/80">
                    <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                        Expected
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        {expected || "No expected product"}
                    </div>
                </div>
            </div>

            <div className="mt-3 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                Assignment Method: <span className="text-slate-700 dark:text-slate-200">{assignmentMethod}</span>
            </div>
        </div>
    );
};

export default Dashboard;
