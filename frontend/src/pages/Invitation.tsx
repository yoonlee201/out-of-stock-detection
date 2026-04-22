import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../_components/Button";
import Field from "../_components/Field";
import { LockIcon, UserIcon } from "../_components/Icons";
import { apiCompleteInvitation, apiVerifyInvitation } from "../api/query/user";

type VerifyResponse = {
    invited_role: "associate" | "manager";
    is_new: boolean;
    user: { first_name: string; last_name: string; email: string; phone?: string };
};

type Form = {
    invitedRole: "associate" | "manager";
    isNew: boolean;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
};

const Invitation = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [form, setForm] = useState<Form | null>(null);

    const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => f && { ...f, [field]: e.target.value });

    useEffect(() => {
        const invitationToken = searchParams.get("token") || "";
        setToken(invitationToken);

        if (!invitationToken) {
            setError("Invitation token is missing.");
            setLoading(false);
            return;
        }

        apiVerifyInvitation(invitationToken)
            .then((data: VerifyResponse) => {
                setForm({
                    invitedRole: data.invited_role,
                    isNew: data.is_new,
                    firstName: data.user.first_name,
                    lastName: data.user.last_name,
                    email: data.user.email,
                    phone: data.user.phone ?? "",
                    password: "",
                });
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to verify invitation."))
            .finally(() => setLoading(false));
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        if (!form) return;

        if (!form.phone.trim()) {
            setError("Phone number is required.");
            return;
        }
        if (form.isNew) {
            if (!form.firstName.trim()) {
                setError("First name is required.");
                return;
            }
            if (!form.lastName.trim()) {
                setError("Last name is required.");
                return;
            }
            if (!form.password.trim()) {
                setError("Password is required.");
                return;
            }
        }

        setSubmitting(true);
        try {
            await apiCompleteInvitation({
                token,
                phone: form.phone.trim(),
                isNew: form.isNew,
                ...(form.isNew && {
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    password: form.password.trim(),
                }),
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
        <div className="bg-background flex min-h-screen w-full items-center justify-center px-4 py-12">
            <div className="border-border bg-background w-full max-w-lg rounded-xl border p-6 shadow-sm">
                <h1 className="text-primary text-2xl font-bold">Continue Invitation</h1>

                {loading && <p className="mt-4 text-sm text-gray-500">Checking your invitation link...</p>}

                {!loading && form && (
                    <>
                        <p className="mt-3 text-sm text-gray-600">
                            {form.isNew ? (
                                <>
                                    Create your account to join as a{" "}
                                    <span className="font-semibold">{form.invitedRole}</span>.
                                </>
                            ) : (
                                <>
                                    Hi {form.firstName}, complete your setup to join as a{" "}
                                    <span className="font-semibold">{form.invitedRole}</span>.
                                </>
                            )}
                        </p>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            {form.isNew && (
                                <div className="flex gap-3">
                                    <Field
                                        label="First Name"
                                        icon={<UserIcon />}
                                        required
                                        value={form.firstName}
                                        onChange={set("firstName")}
                                        className="flex-1"
                                    />
                                    <Field
                                        label="Last Name"
                                        icon={<UserIcon />}
                                        required
                                        value={form.lastName}
                                        onChange={set("lastName")}
                                        className="flex-1"
                                    />
                                </div>
                            )}

                            <Field
                                label="Email"
                                icon={<UserIcon />}
                                type="email"
                                value={form.email}
                                disabled
                                inputClassName="opacity-60 cursor-not-allowed"
                            />

                            <Field
                                label="Phone Number"
                                icon={<UserIcon />}
                                required
                                value={form.phone}
                                onChange={set("phone")}
                            />

                            {form.isNew && (
                                <Field
                                    label="Password"
                                    icon={<LockIcon />}
                                    type="password"
                                    required
                                    value={form.password}
                                    onChange={set("password")}
                                />
                            )}

                            <Button
                                type="submit"
                                disabled={submitting}
                                className="hover:bg-primary-hover active:bg-primary-active w-full bg-primary text-white disabled:opacity-60"
                            >
                                {submitting ? "Saving..." : form.isNew ? "Create Account" : "Continue"}
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

export default Invitation;
