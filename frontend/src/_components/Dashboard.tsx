const Dashboard = () => {
    const products = [
        { name: "Milk", type: "Dairy", qty: 0, aisle: "A2", shelf: "S1" },
        { name: "Coke", type: "Beverage", qty: 3, aisle: "A5", shelf: "S2" },
        { name: "Bread", type: "Bakery", qty: 8, aisle: "A1", shelf: "S3" },
    ];

    return (
        <div className="min-h-screen bg-gray-100 flex">

            {/* Sidebar */}
            <div className="w-64 bg-blue-900 text-white p-6">
                <h2 className="text-2xl font-bold mb-6">Stock Detection</h2>
                <ul className="space-y-4">
                    <li className="hover:text-gray-300 cursor-pointer">Dashboard</li>
                    <li className="hover:text-gray-300 cursor-pointer">Products</li>
                    <li className="hover:text-gray-300 cursor-pointer">Alerts</li>
                    <li className="hover:text-gray-300 cursor-pointer">Reorders</li>
                    <li className="hover:text-gray-300 cursor-pointer">Suppliers</li>
                </ul>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
                <h1 className="text-3xl font-semibold mb-8">Dashboard Overview</h1>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <StatCard title="Total Products" value="120" color="text-blue-600" />
                    <StatCard title="Out of Stock" value="12" color="text-red-600" />
                    <StatCard title="Low Stock" value="8" color="text-yellow-500" />
                    <StatCard title="Active Alerts" value="5" color="text-green-600" />
                </div>

                {/* Products Table */}
                <div className="bg-white shadow rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4">Products</h2>
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
                                            <span className="text-red-600 font-semibold">Out of Stock</span>
                                        ) : (
                                            <span className="text-green-600 font-semibold">In Stock</span>
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
    <div className="bg-white shadow rounded-xl p-6">
        <h4 className="text-gray-500">{title}</h4>
        <h2 className={`text-3xl font-bold ${color}`}>{value}</h2>
    </div>
);

export default Dashboard;