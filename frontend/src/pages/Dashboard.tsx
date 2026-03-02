import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { axiosDefault } from "../api";

interface Product {
    id: number;
    name: string;
    type: string;
    quantity: number;
    aisle: string;
    shelf: string;
}

const Dashboard = () => {
    const { logout } = useAuth();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await axiosDefault.get("/products");
                setProducts(response.data);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const totalProducts = products.length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity < 5).length;

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-64 bg-blue-900 p-6 text-white">
                <h2 className="mb-6 text-2xl font-bold">Stock Detection</h2>
                <ul className="space-y-4">
                    <li className="cursor-pointer hover:text-gray-300">Dashboard</li>
                    <li className="cursor-pointer hover:text-gray-300">Products</li>
                    <li className="cursor-pointer hover:text-gray-300">Alerts</li>
                    <li className="cursor-pointer hover:text-gray-300">Reorders</li>
                    <li className="cursor-pointer hover:text-gray-300">Suppliers</li>
                    <li className="cursor-pointer hover:text-gray-300">Settings</li>
                    <li className="cursor-pointer hover:text-gray-300">
                        <button onClick={logout}>Logout</button>
                    </li>
                </ul>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
                <h1 className="mb-8 text-3xl font-semibold">Dashboard Overview</h1>

                {loading ? (
                    <p>Loading products...</p>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="mb-8 grid grid-cols-4 gap-6">
                            <StatCard title="Total Products" value={String(totalProducts)} color="text-blue-600" />
                            <StatCard title="Out of Stock" value={String(outOfStock)} color="text-red-600" />
                            <StatCard title="Low Stock" value={String(lowStock)} color="text-yellow-500" />
                            <StatCard title="Active Alerts" value="--" color="text-green-600" />
                        </div>

                        {/* Products Table */}
                        <div className="rounded-xl bg-white p-6 shadow">
                            <h2 className="mb-4 text-xl font-semibold">Products</h2>
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
                                        <tr key={p.id} className="border-b hover:bg-gray-50">
                                            <td>{p.name}</td>
                                            <td>{p.type}</td>
                                            <td>{p.quantity}</td>
                                            <td>{p.aisle}</td>
                                            <td>{p.shelf}</td>
                                            <td>
                                                {p.quantity === 0 ? (
                                                    <span className="font-semibold text-red-600">Out of Stock</span>
                                                ) : (
                                                    <span className="font-semibold text-green-600">In Stock</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
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