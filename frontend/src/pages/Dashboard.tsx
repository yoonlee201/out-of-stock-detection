import { useEffect, useMemo, useState } from "react";
import Sidebar from "../_components/Sidebar";
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

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex-1 p-8">
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

                <div className="mb-8 grid grid-cols-4 gap-6">
                    <StatCard title="Total Products" value={String(totalProducts)} color="text-blue-600" />
                    <StatCard title="Out of Stock" value={String(outOfStockCount)} color="text-red-600" />
                    <StatCard title="Low Stock" value={String(lowStockCount)} color="text-yellow-500" />
                    <StatCard title="Active Alerts" value={String(activeAlerts)} color="text-green-600" />
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

export default Dashboard;
