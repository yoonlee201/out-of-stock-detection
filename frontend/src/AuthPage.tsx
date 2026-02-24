import Login from "./_components/Login";
import Register from "./_components/Register";

const AuthPage = () => (
    <div className="flex min-h-screen flex-col md:flex-row">
        <Login />
        <Register />
    </div>
);

export default AuthPage;
