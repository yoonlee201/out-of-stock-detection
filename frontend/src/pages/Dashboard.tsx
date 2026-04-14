import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Sidebar from "../_components/Sidebar";
import { apiAnalyzeShelf, type ShelfAnalysisResponse, type ShelfDetection } from "../api/query/shelfAnalysis";
import { useAuth } from "../hooks/useAuth";
import { apiMakeOutOfStockAlert } from "../api/query/alert";

interface Product {
    product_id: number;
    name: string;
    type: string;
    qrcode: string;
    quantity_in_store: number;
    aisle: string;
    shelf: string;
    supplier_id: number;
}

const Dashboard = () => {
    const { user } = useAuth(); // Placeholder for actual user context
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState("");
    const [analysisResult, setAnalysisResult] = useState<ShelfAnalysisResponse | null>(null);
    const SAMPLE_PRODUCTS: Product[] = [
        {
            product_id: 1,
            name: "General Mills Rice Chex (Family Size)",
            type: "Cereal",
            qrcode: "SKU_CHEX_RICE_FAM",
            quantity_in_store: 6,
            aisle: "Aisle 4",
            shelf: "Top",
            supplier_id: 11,
        },
        {
            product_id: 2,
            name: "General Mills Cheerios Oat Crunch",
            type: "Cereal",
            qrcode: "SKU_CHEERIOS_OAT",
            quantity_in_store: 0,
            aisle: "Aisle 4",
            shelf: "Middle",
            supplier_id: 11,
        },
        {
            product_id: 3,
            name: "Kellogg's Crispix (Family Size)",
            type: "Cereal",
            qrcode: "SKU_CRISPIX_FAM",
            quantity_in_store: 3,
            aisle: "Aisle 4",
            shelf: "Top",
            supplier_id: 12,
        },
        {
            product_id: 4,
            name: "Quaker Life Original",
            type: "Cereal",
            qrcode: "SKU_LIFE_ORIG",
            quantity_in_store: 2,
            aisle: "Aisle 4",
            shelf: "Bottom",
            supplier_id: 13,
        },
    ];

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch("http://localhost:8000/products/");
                if (!response.ok) {
                    throw new Error("Failed to fetch products");
                }

                const data = await response.json();
                setProducts(data);
            } catch (err) {
                console.error("Error fetching products:", err);
                setError("Failed to load products.");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const displayProducts = products.length > 0 ? products : SAMPLE_PRODUCTS;
    const issueDetections = useMemo(() => {
        if (!analysisResult) {
            return [];
        }

        return analysisResult.detections.filter((detection) =>
            detection.audit_status === "missing" || detection.audit_status === "misplaced"
        );
    }, [analysisResult]);

    const reviewDetections = useMemo(() => {
        if (!analysisResult) {
            return [];
        }

        return analysisResult.detections.filter((detection) => detection.audit_status === "unverified");
    }, [analysisResult]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setSelectedImage(file);
        setAnalysisError("");
    };

    const handleAnalyzeShelf = async () => {
        if (!selectedImage) {
            setAnalysisError("Please upload a shelf image first.");
            return;
        }

        try {
            setAnalysisLoading(true);
            setAnalysisError("");
            const result = await apiAnalyzeShelf(selectedImage);
            setAnalysisResult(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Shelf analysis failed.";
            setAnalysisError(message);
        } finally {
            setAnalysisLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex-1 overflow-y-auto p-8">
                <h1 className="mb-8 text-3xl font-semibold">Dashboard Overview</h1>
                {(user?.role === "manager" || user?.role === "supervisor") && (
                    <button
                        className="bg-secondary mb-4 rounded px-4 py-2 text-white hover:bg-blue-600"
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

                <div className="mb-8 rounded-xl bg-white p-6 shadow">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">Shelf Analyzer</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Upload a shelf image to compare it against the planogram, mark empty slots, and flag misplaced items.
                            </p>
                        </div>
                        {analysisResult && (
                            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                                {analysisResult.summary.correct_count ?? 0} correct · {analysisResult.summary.missing_count ?? analysisResult.summary.empty_space_count} missing · {analysisResult.summary.misplaced_count ?? 0} misplaced
                                {analysisResult.compliance_report &&
                                    ` · Rows visible ${analysisResult.compliance_report.visible_rows.length}/${analysisResult.compliance_report.total_planogram_rows} · Compliance ${analysisResult.compliance_report.compliance_score}%`}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(320px,360px),minmax(0,1fr)]">
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <h3 className="text-lg font-semibold text-slate-800">Upload</h3>
                            <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                onChange={handleFileChange}
                                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-secondary/12 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-secondary"
                            />

                            <button
                                type="button"
                                onClick={handleAnalyzeShelf}
                                disabled={!selectedImage || analysisLoading}
                                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-active w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                {analysisLoading ? "Analyzing..." : "Analyze Shelf"}
                            </button>

                            {analysisError && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                    {analysisError}
                                </div>
                            )}

                            {analysisResult && (
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                                    <SummaryCard
                                        label="Correct"
                                        value={analysisResult.summary.correct_count ?? 0}
                                        accent="text-emerald-600"
                                    />
                                    <SummaryCard
                                        label="Missing"
                                        value={analysisResult.summary.missing_count ?? analysisResult.summary.empty_space_count}
                                        accent="text-rose-600"
                                    />
                                    <SummaryCard
                                        label="Misplaced"
                                        value={analysisResult.summary.misplaced_count ?? 0}
                                        accent="text-amber-600"
                                    />
                                    <SummaryCard
                                        label="Unverified"
                                        value={analysisResult.summary.unverified_count ?? 0}
                                        accent="text-blue-600"
                                    />
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

                                    {reviewDetections.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                Needs Review
                                            </h4>
                                            <div className="space-y-3">
                                                {reviewDetections.map((detection, index) => (
                                                    <IssueCard
                                                        key={`review-${index}-${detection.bbox.join("-")}`}
                                                        detection={detection}
                                                        reviewOnly
                                                    />
                                                ))}
                                            </div>
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
                                                    <th className="py-3">Confidence</th>
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

                <div className="rounded-xl bg-white p-6 shadow">
                    <h2 className="mb-4 text-xl font-semibold">Products</h2>

                    {loading && <p>Loading products...</p>}
                    {error && null}

                    {!loading && !error && (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Quantity</th>
                                    <th>Aisle</th>
                                    <th>Shelf</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayProducts.map((p) => (
                                    <tr key={p.product_id} className="border-b hover:bg-gray-50">
                                        <td>{p.name}</td>
                                        <td>{p.type}</td>
                                        <td>{p.quantity_in_store}</td>
                                        <td>{p.aisle}</td>
                                        <td>{p.shelf}</td>
                                        <td>
                                            {p.quantity_in_store === 0 ? (
                                                <span className="font-semibold text-red-600">Out of Stock</span>
                                            ) : p.quantity_in_store <= 10 ? (
                                                <span className="font-semibold text-yellow-600">Low Stock</span>
                                            ) : (
                                                <span className="font-semibold text-green-600">In Stock</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
);

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

    return (
        <tr className={`border-b ${statusTone(status)}`}>
            <td className="py-3 font-semibold text-slate-700">{detection.issue_marker || "-"}</td>
            <td className="py-3 font-medium text-slate-700">{detection.slot_id || "-"}</td>
            <td className="py-3 font-medium capitalize text-slate-700">{status.replace("_", " ")}</td>
            <td className="py-3 text-slate-600">{observed || "-"}</td>
            <td className="py-3 text-slate-600">{expected || "-"}</td>
            <td className="py-3 text-slate-600 capitalize">{assignmentMethod}</td>
            <td className="py-3 text-slate-600">
                {typeof detection.sku?.confidence === "number" ? detection.sku.confidence.toFixed(2) : "-"}
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
