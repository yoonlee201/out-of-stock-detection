import Sidebar from "../_components/Sidebar";

const Dashboard = () => {
    const products = [
        { name: "Milk", type: "Dairy", qty: 0, aisle: "A2", shelf: "S1" },
        { name: "Coke", type: "Beverage", qty: 3, aisle: "A5", shelf: "S2" },
        { name: "Bread", type: "Bakery", qty: 8, aisle: "A1", shelf: "S3" },
    ];

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 p-8">
                <h1 className="mb-8 text-3xl font-semibold">Dashboard Overview</h1>

                {/* Stats */}
                <div className="mb-8 grid grid-cols-4 gap-6">
                    <StatCard title="Total Products" value="120" color="text-blue" />
                    <StatCard title="Out of Stock" value="12" color="text-red" />
                    <StatCard title="Low Stock" value="8" color="text-yellow" />
                    <StatCard title="Active Alerts" value="5" color="text-green" />
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
                            {products.map((p, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                    <td>{p.name}</td>
                                    <td>{p.type}</td>
                                    <td>{p.qty}</td>
                                    <td>{p.aisle}</td>
                                    <td>{p.shelf}</td>
                                    <td>
                                        {p.qty === 0 ? (
                                            <span className="text-red font-semibold">Out of Stock</span>
                                        ) : (
                                            <span className="text-green font-semibold">In Stock</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
