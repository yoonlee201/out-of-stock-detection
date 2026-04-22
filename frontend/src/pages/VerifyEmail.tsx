import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiVerifyEmail } from "../api/query/user";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("Verifying your email...");
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const token = searchParams.get("token") || "";

        if (!token) {
            setMessage("Verification token is missing.");
            setLoading(false);
            return;
        }

        const verify = async () => {
            try {
                const data = await apiVerifyEmail(token);
                setMessage(data?.message || "Email verified successfully.");
                setIsSuccess(true);
            } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed to verify email.");
                setIsSuccess(false);
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [searchParams]);

    return (
        <div className="bg-background flex min-h-screen w-full items-center justify-center px-4 py-12">
            <div className="border-border bg-background w-full max-w-md rounded-xl border p-6 shadow-sm">
                <h1 className="text-primary text-2xl font-bold">Email Verification</h1>
                <p className={`mt-4 text-sm ${isSuccess ? "text-green-700" : "text-gray-700"}`}>{message}</p>

                {!loading && (
                    <div className="mt-6">
                        <Link
                            to="/login"
                            className="hover:bg-primary-hover active:bg-primary-active inline-flex w-full items-center justify-center rounded bg-primary px-4 py-2 font-semibold text-white"
                        >
                            Continue to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
