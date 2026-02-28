import { useNavigate } from "react-router-dom";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { LockIcon, UserIcon } from "../_components/Icons";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useState } from "react";
import { apiRegisterUser } from "../api/query/user";
import logger from "../utils/log";

const Register = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            navigate("/dashboard");
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        // Trigger entrance animation
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        return () => {
            setError("");
        };
    }, [password, confirmPassword, email, firstName, lastName, phone]);

    const register = async (): Promise<void> => {
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            await apiRegisterUser({
                email,
                password,
                firstName,
                lastName,
                phone,
            });
            navigate(`/login?register=success&firstName=${encodeURIComponent(firstName)}`);
            setError("");
        } catch (error) {
            logger.error(error);
            setError(error instanceof Error ? error.message : "Unknown error");
        }
    };

    return (
        <div className="flex h-screen w-screen flex-1 items-center justify-center px-8 py-12">
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
                <h1 className="text-primary mb-8 text-center text-4xl font-bold" style={{ animationDelay: "0.05s" }}>
                    Register
                </h1>

                <div className="anim-item" style={{ animationDelay: "0.15s" }}>
                    <Field
                        required
                        key={"first-name"}
                        label={"First Name"}
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        icon={<UserIcon />}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                    />
                </div>
                <div className="anim-item" style={{ animationDelay: "0.15s" }}>
                    <Field
                        required
                        key={"last-name"}
                        label={"Last Name"}
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        icon={<UserIcon />}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                    />
                </div>
                <div className="anim-item" style={{ animationDelay: "0.15s" }}>
                    <Field
                        required
                        key={"email"}
                        label={"Email"}
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        icon={<UserIcon />}
                        value={email}
                        onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
                    />
                </div>
                <div className="anim-item" style={{ animationDelay: "0.22s" }}>
                    <Field
                        required
                        key={"password"}
                        label={"Password"}
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        type="password"
                        icon={<LockIcon />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
                    />
                </div>
                <div className="anim-item" style={{ animationDelay: "0.22s" }}>
                    <Field
                        required
                        key={"confirm-password"}
                        label={"Confirm Password"}
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        type="password"
                        icon={<LockIcon />}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ""))}
                    />
                </div>
                <div className="anim-item" style={{ animationDelay: "0.22s" }}>
                    <Field
                        required
                        key={"phone-number"}
                        label={"Phone Number"}
                        labelClassName="text-gray-600"
                        inputClassName="border-gray-400"
                        icon={<UserIcon />}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
                    />
                </div>
                <div className="anim-item mt-4" style={{ animationDelay: "0.30s" }}>
                    <Button
                        className="bg-primary hover:bg-primary-hover active:bg-primary-active mt-4 w-full text-white"
                        onClick={() => register()}
                    >
                        Register
                    </Button>
                </div>

                {error && (
                    <p className="text-sm text-red-600" style={{ animation: "fadeSlideUp 0.3s ease forwards" }}>
                        {error}
                    </p>
                )}
                <div
                    className="anim-item mt-8 flex items-center justify-center gap-1"
                    style={{ animationDelay: "0.38s" }}
                >
                    {"Do you have an account? "}
                    <a href="/login" className="text-gray-500 underline transition-colors hover:text-gray-700">
                        Login here.
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Register;
