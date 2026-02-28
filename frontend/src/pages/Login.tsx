import { useEffect, useState } from "react";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { LockIcon, UserIcon } from "../_components/Icons";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import logger from "../utils/log";

const Login = () => {
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");

    useEffect(() => {
        if (!loading && user) {
            navigate("/dashboard");
        }
    }, [user, loading, navigate]);

    const handleLogin = async () => {
        setError("");

        try {
            await login(email, password);
            navigate("/dashboard");
        } catch (err: unknown) {
            logger.error("Login error:", err);
            const message = err instanceof Error ? err.message : "Login failed.";
            setError(message);
        }
    };

    if (loading) {
        return (
            <div className="page-center">
                <div>Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen flex-1 items-center justify-center bg-white px-8 py-12">
            <div className="flex w-full max-w-sm flex-col gap-3">
                <h1 className="text-primary mb-5 text-center text-4xl font-bold">Login</h1>
                <Field
                    required
                    label="Email"
                    labelClassName="text-gray-600"
                    inputClassName="border-gray-400"
                    icon={<UserIcon />}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <Field
                    required
                    label="Password"
                    labelClassName="text-gray-600"
                    inputClassName="border-gray-400"
                    type="password"
                    icon={<LockIcon />}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                    onClick={handleLogin}
                    className="bg-primary hover:bg-primary-hover active:bg-primary-active mt-4 w-full text-white"
                >
                    Log In
                </Button>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="mt-8 flex flex-col items-center justify-center gap-1">
                    <div className="text-center text-sm">
                        {"Don't have an account? "}
                        <a href="/register" className="text-gray-500 underline transition-colors hover:text-gray-700">
                            Register here.
                        </a>
                    </div>
                    <div className="text-center">
                        <a href="#" className="text-sm text-gray-500 underline transition-colors hover:text-gray-700">
                            Forgot Password?
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
