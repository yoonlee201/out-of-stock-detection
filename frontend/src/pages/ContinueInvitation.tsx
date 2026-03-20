import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { UserIcon } from "../_components/Icons";
import { apiCompleteInvitation, apiVerifyInvitation } from "../api/query/user";

type InvitationDetails = {
    invited_role: "associate" | "manager";
    user: {
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        carrier?: string;
    };
};

const ContinueInvitation = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [details, setDetails] = useState<InvitationDetails | null>(null);

    const [phone, setPhone] = useState("");

    useEffect(() => {
        const invitationToken = searchParams.get("token") || "";
        setToken(invitationToken);

        if (!invitationToken) {
            setError("Invitation token is missing.");
            setLoading(false);
            return;
        }

        const verify = async () => {
            try {
                const data = await apiVerifyInvitation(invitationToken);
                setDetails(data);
                setPhone(data.user?.phone || "");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to verify invitation.");
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!token) {
            setError("Invitation token is missing.");
            return;
        }

        if (!phone.trim()) {
            setError("Phone number is required.");
            return;
        }

        setSubmitting(true);
        try {
            await apiCompleteInvitation({
                token,
                phone: phone.trim()
            });
            setSuccess("Your invitation is complete. You can now log in.");
            setTimeout(() => navigate("/login"), 1200);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to complete invitation.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h1 className="text-primary text-2xl font-bold">Continue Invitation</h1>

                {loading && <p className="mt-4 text-sm text-gray-500">Checking your invitation link...</p>}

                {!loading && details && (
                    <>
                        <p className="mt-3 text-sm text-gray-600">
                            Hi {details.user.first_name} {details.user.last_name}, complete your setup to join as a
                            <span className="font-semibold"> {details.invited_role}</span>.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <Field
                                label="Phone Number"
                                icon={<UserIcon />}
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-active w-full text-white disabled:opacity-60"
                            >
                                {submitting ? "Saving..." : "Continue"}
                            </Button>
                        </form>
                    </>
                )}

                {!!error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                {!!success && <p className="mt-4 text-sm text-green-600">{success}</p>}
            </div>
        </div>
    );
};

export default ContinueInvitation;
