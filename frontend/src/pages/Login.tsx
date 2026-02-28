import { useEffect, useState } from "react";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { LockIcon, UserIcon } from "../_components/Icons";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import logger from "../utils/log";
import RegisterSuccess from "../_components/RegisterSuccess";
import Loading from "../_components/Loading";
import { useForm } from "react-hook-form";

type LoginForm = {
    email: string;
    password: string;
};

const Login = () => {
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [visible, setVisible] = useState(false);

    const isRegisterSuccess = searchParams.get("register") === "success";
    const firstName = searchParams.get("firstName") || "";

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>();

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!loading && user) navigate("/dashboard");
    }, [user, loading, navigate]);

    const onSubmit = async (data: LoginForm) => {
        try {
            await login(data.email, data.password);
            navigate("/dashboard");
        } catch (err: unknown) {
            logger.error("Login error:", err);
            const message = err instanceof Error ? err.message : "Login failed.";
            setError("root", { message });
        }
    };

    const handleDismissSuccess = () => {
        navigate("/login", { replace: true });
    };

    if (loading) return <Loading message="Checking authentication..." />;

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

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex w-full max-w-sm flex-col gap-3"
                style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}
            >
                <h1
                    className="anim-item text-primary mb-5 text-center text-4xl font-bold"
                    style={{ animationDelay: "0.05s" }}
                >
                    Login
                </h1>

                <Field
                    required
                    label="Email"
                    icon={<UserIcon />}
                    animationDelay="0.15s"
                    error={errors.email?.message}
                    {...register("email", {
                        required: "Email is required",
                        pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email address" },
                    })}
                />
                <Field
                    required
                    label="Password"
                    type="password"
                    icon={<LockIcon />}
                    animationDelay="0.22s"
                    error={errors.password?.message}
                    {...register("password", { required: "Password is required" })}
                />

                <div className="anim-item mt-4" style={{ animationDelay: "0.30s" }}>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-primary hover:bg-primary-hover active:bg-primary-active w-full text-white disabled:opacity-60"
                    >
                        {isSubmitting ? "Logging in..." : "Log In"}
                    </Button>
                </div>

                {errors.root && (
                    <p className="text-sm text-red-600" style={{ animation: "fadeSlideUp 0.3s ease forwards" }}>
                        {errors.root.message}
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
            </form>
        </div>
    );
};

export default Login;