import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Button from "../_components/Button";
import Sidebar from "../_components/Sidebar";
import { apiAnalyzePlanogram, type PlanogramAnalysisResponse } from "../api/query/spaceDetection";
import {
    loadLatestPlanogramAuditSummary,
    saveLatestPlanogramAuditSummary,
    type StoredMissingItem,
    type StoredPlanogramAuditSummary,
} from "../utils/planogramAuditStorage";

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
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [latestAudit, setLatestAudit] = useState<StoredPlanogramAuditSummary | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [sceneId, setSceneId] = useState("");
    const [datasetRoot, setDatasetRoot] = useState("space_detection/synthetic_dataset");
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState("");
    const [analysisResult, setAnalysisResult] = useState<PlanogramAnalysisResponse | null>(null);

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

    useEffect(() => {
        setLatestAudit(loadLatestPlanogramAuditSummary());
    }, []);

    const totalProducts = products.length;

    const outOfStockCount = useMemo(() => {
        return products.filter((p) => p.quantity_in_store === 0).length;
    }, [products]);

    const lowStockCount = useMemo(() => {
        return products.filter((p) => p.quantity_in_store > 0 && p.quantity_in_store <= 10).length;
    }, [products]);

    const activeAlerts = outOfStockCount + lowStockCount;

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setSelectedFile(file);
        if (file) {
            setSceneId(file.name.replace(/\.[^.]+$/, ""));
        }
        setAuditError("");
    };

    const handleAnalyzePlanogram = async () => {
        if (!selectedFile) {
            setAuditError("Choose a shelf image before running the audit.");
            return;
        }

        if (!sceneId.trim()) {
            setAuditError("Enter the matching scene ID, such as `valid_0001`.");
            return;
        }

        try {
            setAuditLoading(true);
            setAuditError("");

            const result = await apiAnalyzePlanogram({
                image: selectedFile,
                sceneId: sceneId.trim(),
                datasetRoot,
            });

            setAnalysisResult(result);
            saveLatestPlanogramAuditSummary(result);
            setLatestAudit(loadLatestPlanogramAuditSummary());
        } catch (err) {
            const message = err instanceof Error ? err.message : "Planogram analysis failed.";
            setAuditError(message);
        } finally {
            setAuditLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex-1 overflow-y-auto p-8">
                <h1 className="mb-8 text-3xl font-semibold">Dashboard Overview</h1>

                <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Total Products" value={String(totalProducts)} color="text-blue-600" />
                    <StatCard title="Out of Stock" value={String(outOfStockCount)} color="text-red-600" />
                    <StatCard title="Low Stock" value={String(lowStockCount)} color="text-yellow-500" />
                    <StatCard title="Active Alerts" value={String(activeAlerts)} color="text-green-600" />
                </div>

                <div className="mb-8 rounded-xl bg-white p-6 shadow">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold">Shelf Audit Map</h2>
                        {latestAudit && (
                            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                                {latestAudit.missing_items.length} issue{latestAudit.missing_items.length === 1 ? "" : "s"}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),220px,200px]">
                        <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp"
                            onChange={handleFileChange}
                            className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-secondary/12 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-secondary"
                        />
                        <input
                            type="text"
                            placeholder="Scene ID"
                            value={sceneId}
                            onChange={(event) => setSceneId(event.target.value)}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-primary outline-none transition focus:border-secondary focus:ring-4 focus:ring-secondary/10"
                        />
                        <Button
                            type="button"
                            onClick={handleAnalyzePlanogram}
                            disabled={auditLoading || !selectedFile}
                            className="bg-secondary hover:bg-secondary-hover active:bg-secondary-active rounded-2xl py-3 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {auditLoading ? "Running..." : "Run Audit"}
                        </Button>
                    </div>

                    <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
                            Dataset location
                        </summary>
                        <input
                            type="text"
                            value={datasetRoot}
                            onChange={(event) => setDatasetRoot(event.target.value)}
                            className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-primary outline-none transition focus:border-secondary focus:ring-4 focus:ring-secondary/10"
                        />
                    </details>

                    {auditError && (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {auditError}
                        </div>
                    )}

                    <div className="mt-6">
                        {analysisResult ? (
                            <img
                                src={analysisResult.annotated_image}
                                alt="Shelf audit map"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain"
                            />
                        ) : (
                            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500">
                                <div className="max-w-md px-6">
                                    <p className="text-lg font-semibold text-slate-700">Run the shelf audit</p>
                                    <p className="mt-2 text-sm leading-6">
                                        The labeled shelf image now lives directly on the dashboard.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold">Products</h2>
                        {latestAudit && (
                            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                                Latest audit: {latestAudit.missing_items.length} issue
                                {latestAudit.missing_items.length === 1 ? "" : "s"}
                            </div>
                        )}
                    </div>

                    {loading && <p>Loading products...</p>}
                    {error && <p className="font-medium text-red-600">{error}</p>}

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
                                {latestAudit?.missing_items.length ? (
                                    <>
                                        {latestAudit.missing_items.map((item) => (
                                            <MissingItemRow key={`${item.slot_id}-${item.expected_sku}`} item={item} />
                                        ))}
                                        {products.length > 0 && <SectionRow label="Inventory products" />}
                                    </>
                                ) : null}

                                {products.map((p) => (
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

                                {!latestAudit?.missing_items.length && products.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                                            No products or audit findings to show yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

interface StatCardProps {
    title: string;
    value: string;
    color: string;
}

const StatCard = ({ title, value, color }: StatCardProps) => (
    <div className="rounded-xl bg-white p-6 shadow">
        <h4 className="text-gray-500">{title}</h4>
        <h2 className={`text-3xl font-bold ${color}`}>{value}</h2>
    </div>
);

const SectionRow = ({ label }: { label: string }) => (
    <tr className="border-b bg-slate-50">
        <td colSpan={6} className="py-3 text-sm font-semibold text-slate-600">
            {label}
        </td>
    </tr>
);

const MissingItemRow = ({ item }: { item: StoredMissingItem }) => {
    const issueLabel = item.reason === "empty_slot" ? "Missing" : "Wrongly placed";
    const expectedName = item.expected_display_name || item.expected_sku;
    const observedName = item.observed_display_name || item.observed_sku || "Empty";
    const slotMatch = item.slot_id.match(/shelf_(\d+)_slot_(\d+)/i);
    const aisleLabel = slotMatch ? `Shelf ${slotMatch[1]}` : "-";
    const shelfLabel = slotMatch ? `Slot ${slotMatch[2]}` : item.slot_id;

    return (
        <tr className="border-b last:border-b-0 hover:bg-gray-50">
            <td className="py-3">
                <div className="font-medium text-primary">{expectedName}</div>
                {item.reason !== "empty_slot" && (
                    <div className="mt-1 text-sm text-slate-500">Observed: {observedName}</div>
                )}
            </td>
            <td className="py-3 text-slate-600">Audit finding</td>
            <td className="py-3 text-slate-600">-</td>
            <td className="py-3 text-slate-600">{aisleLabel}</td>
            <td className="py-3 text-slate-600">{shelfLabel}</td>
            <td className="py-3">
                <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                        item.reason === "empty_slot"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                    }`}
                >
                    {issueLabel}
                </span>
            </td>
        </tr>
    );
};

export default Dashboard;
