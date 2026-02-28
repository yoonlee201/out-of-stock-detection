import { useNavigate } from "react-router-dom";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { LockIcon, UserIcon } from "../_components/Icons";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useState } from "react";
import { apiRegisterUser } from "../api/query/user";
import logger from "../utils/log";
import Loading from "../_components/Loading";
import { useForm } from "react-hook-form";

type RegisterForm = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone: string;
};

const Register = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<RegisterForm>();

    useEffect(() => {
        if (!loading && user) navigate("/dashboard");
    }, [user, loading, navigate]);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    const onSubmit = async (data: RegisterForm) => {
        if (data.password !== data.confirmPassword) {
            setError("confirmPassword", { message: "Passwords do not match." });
            return;
        }

        try {
            await apiRegisterUser({
                email: data.email,
                password: data.password,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
            });
            navigate(`/login?register=success&firstName=${encodeURIComponent(data.firstName)}`);
        } catch (error) {
            logger.error(error);
            setError("root", { message: error instanceof Error ? error.message : "Unknown error" });
        }
    };

    if (loading) return <Loading message="Checking authentication..." />;

    return (
        <div className="flex h-screen w-screen flex-1 items-center justify-center px-8 py-12">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex w-full max-w-sm flex-col gap-3"
                style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}
            >
                <h1 className="text-primary mb-8 text-center text-4xl font-bold">Register</h1>

                <Field
                    required
                    label="First Name"
                    icon={<UserIcon />}
                    animationDelay="0.10s"
                    error={errors.firstName?.message}
                    {...register("firstName", { required: "First name is required" })}
                />
                <Field
                    required
                    label="Last Name"
                    icon={<UserIcon />}
                    animationDelay="0.15s"
                    error={errors.lastName?.message}
                    {...register("lastName", { required: "Last name is required" })}
                />
                <Field
                    required
                    label="Email"
                    icon={<UserIcon />}
                    animationDelay="0.20s"
                    error={errors.email?.message}
                    {...register("email", {
                        required: "Email is required",
                        pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email address" },
                        setValueAs: (v) => v.replace(/\s/g, ""),
                    })}
                />
                <Field
                    required
                    label="Password"
                    type="password"
                    icon={<LockIcon />}
                    animationDelay="0.25s"
                    error={errors.password?.message}
                    {...register("password", {
                        required: "Password is required",
                        minLength: { value: 8, message: "Password must be at least 8 characters" },
                        setValueAs: (v) => v.replace(/\s/g, ""),
                    })}
                />
                <Field
                    required
                    label="Confirm Password"
                    type="password"
                    icon={<LockIcon />}
                    animationDelay="0.30s"
                    error={errors.confirmPassword?.message}
                    {...register("confirmPassword", {
                        required: "Please confirm your password",
                        validate: (val) => val === watch("password") || "Passwords do not match.",
                        setValueAs: (v) => v.replace(/\s/g, ""),
                    })}
                />
                <Field
                    required
                    label="Phone Number"
                    icon={<UserIcon />}
                    animationDelay="0.35s"
                    error={errors.phone?.message}
                    {...register("phone", {
                        required: "Phone number is required",
                        setValueAs: (v) => v.replace(/\s/g, ""),
                    })}
                />

                <div className="mt-4">
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-primary hover:bg-primary-hover active:bg-primary-active mt-4 w-full text-white disabled:opacity-60"
                    >
                        {isSubmitting ? "Registering..." : "Register"}
                    </Button>
                </div>

                {errors.root && (
                    <p className="text-sm text-red-600" style={{ animation: "fadeSlideUp 0.3s ease forwards" }}>
                        {errors.root.message}
                    </p>
                )}

                <div className="mt-8 flex items-center justify-center gap-1">
                    {"Do you have an account? "}
                    <a href="/login" className="text-gray-500 underline transition-colors hover:text-gray-700">
                        Login here.
                    </a>
                </div>
            </form>
        </div>
    );
};

export default Register;