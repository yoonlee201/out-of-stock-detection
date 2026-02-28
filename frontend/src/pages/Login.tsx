import { useEffect, useState } from "react";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { LockIcon, UserIcon } from "../_components/Icons";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import logger from "../utils/log";
import RegisterSuccess from "../_components/RegisterSuccess";

const Login = () => {
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const isRegisterSuccess = searchParams.get("register") === "success";
    const firstName = searchParams.get("firstName") || "";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger entrance animation
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

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

    const handleDismissSuccess = () => {
        navigate("/login", { replace: true });
    };

    if (loading) {
        return (
            <div className="page-center">
                <div>Loading...</div>
            </div>
        );
    }

    if (isRegisterSuccess) {
        return <RegisterSuccess firstName={firstName} onContinue={handleDismissSuccess} />;
    }

    return (
        <div className="flex h-screen w-screen flex-1 items-center justify-center bg-white px-8 py-12">
            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .anim-item {
                    opacity: 0;
                    animation: fadeSlideUp 0.5s ease forwards;
                }
            `}</style>

            <div
                className="flex w-full max-w-sm flex-col gap-3"
                style={{
                    opacity: visible ? 1 : 0,
                    transition: "opacity 0.3s ease",
                }}
            >
                {/* Each item staggers in */}
                <h1
                    className="anim-item text-primary mb-5 text-center text-4xl font-bold"
                    style={{ animationDelay: "0.05s" }}
                >
                    Login
                </h1>

                <div className="anim-item" style={{ animationDelay: "0.15s" }}>
                    <Field
                        required
                        label="Email"
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        icon={<UserIcon />}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="anim-item" style={{ animationDelay: "0.22s" }}>
                    <Field
                        required
                        label="Password"
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        type="password"
                        icon={<LockIcon />}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className="anim-item mt-4" style={{ animationDelay: "0.30s" }}>
                    <Button
                        onClick={handleLogin}
                        className="bg-primary hover:bg-primary-hover active:bg-primary-active w-full text-white"
                    >
                        Log In
                    </Button>
                </div>

                {error && (
                    <p className="text-sm text-red-600" style={{ animation: "fadeSlideUp 0.3s ease forwards" }}>
                        {error}
                    </p>
                )}

                <div
                    className="anim-item mt-8 flex flex-col items-center justify-center gap-1"
                    style={{ animationDelay: "0.38s" }}
                >
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
