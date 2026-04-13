import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Sidebar from "../_components/Sidebar";
import { apiAnalyzeShelf, type ShelfAnalysisResponse, type ShelfDetection } from "../api/query/shelfAnalysis";

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
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState("");
    const [analysisResult, setAnalysisResult] = useState<ShelfAnalysisResponse | null>(null);

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

                <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Total Products" value={String(totalProducts)} color="text-blue-600" />
                    <StatCard title="Out of Stock" value={String(outOfStockCount)} color="text-red-600" />
                    <StatCard title="Low Stock" value={String(lowStockCount)} color="text-yellow-500" />
                    <StatCard title="Active Alerts" value={String(activeAlerts)} color="text-green-600" />
                </div>

                <div className="mb-8 rounded-xl bg-white p-6 shadow">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">Shelf Analyzer</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Upload a shelf image to detect products, identify SKUs, and mark empty spaces.
                            </p>
                        </div>
                        {analysisResult && (
                            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                                {analysisResult.summary.product_count} products · {analysisResult.summary.empty_space_count} empty
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
                                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                                    <SummaryCard
                                        label="Products"
                                        value={analysisResult.summary.product_count}
                                        accent="text-emerald-600"
                                    />
                                    <SummaryCard
                                        label="Empty Spaces"
                                        value={analysisResult.summary.empty_space_count}
                                        accent="text-rose-600"
                                    />
                                    <SummaryCard
                                        label="Unique SKUs"
                                        value={analysisResult.summary.unique_sku_count}
                                        accent="text-blue-600"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                {analysisResult ? (
                                    <img
                                        src={analysisResult.annotated_image}
                                        alt="Shelf analysis result"
                                        className="w-full rounded-2xl border border-slate-200 bg-white object-contain"
                                    />
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
                                    <h3 className="mb-4 text-lg font-semibold">Detections</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[900px] text-left text-sm">
                                            <thead>
                                                <tr className="border-b text-slate-500">
                                                    <th className="py-3">#</th>
                                                    <th className="py-3">Type</th>
                                                    <th className="py-3">Brand</th>
                                                    <th className="py-3">Product Name</th>
                                                    <th className="py-3">Variant</th>
                                                    <th className="py-3">Size</th>
                                                    <th className="py-3">Confidence</th>
                                                    <th className="py-3">Bounding Box</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analysisResult.detections.map((detection, index) => (
                                                    <DetectionRow
                                                        key={`${detection.type}-${index}-${detection.bbox.join("-")}`}
                                                        detection={detection}
                                                        index={index + 1}
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

                                {products.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                                            No products to show yet.
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

const SummaryCard = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
);

const DetectionRow = ({ detection, index }: { detection: ShelfDetection; index: number }) => {
    const isEmpty = detection.type === "empty_space";
    const sku = detection.sku;

    return (
        <tr className={`border-b ${isEmpty ? "bg-rose-50" : "hover:bg-gray-50"}`}>
            <td className="py-3">{index}</td>
            <td className="py-3 font-medium text-slate-700">{isEmpty ? "empty_space" : "product"}</td>
            <td className="py-3 text-slate-600">{sku?.brand || "-"}</td>
            <td className="py-3 text-slate-600">{sku?.product_name || "-"}</td>
            <td className="py-3 text-slate-600">{sku?.variant || "-"}</td>
            <td className="py-3 text-slate-600">{sku?.size || "-"}</td>
            <td className="py-3 text-slate-600">
                {typeof sku?.confidence === "number" ? sku.confidence.toFixed(2) : "-"}
            </td>
            <td className="py-3 font-mono text-xs text-slate-500">[{detection.bbox.join(", ")}]</td>
        </tr>
    );
};

export default Dashboard;
