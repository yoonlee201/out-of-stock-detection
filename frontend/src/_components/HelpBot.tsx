import { useState, useRef, useEffect } from "react";
import { axiosDefault } from "../api";

type Message = {
    role: "user" | "bot";
    text: string;
};

const INITIAL_MESSAGE: Message = {
    role: "bot",
    text: "Hey! I'm your shelf intelligence assistant. Ask me anything about uploading images, reading results, alerts, or inventory management.",
};

const SUGGESTIONS = [
    "How do I upload a shelf image?",
    "What does misplaced mean?",
    "What is the compliance score?",
    "How do alerts work?",
    "What are the user roles?",
    "Show current inventory status",
];

function renderAnswer(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((part, j) =>
            j % 2 === 1 ? (
                <strong key={j} style={{ color: "var(--color-text)", fontWeight: 700 }}>
                    {part}
                </strong>
            ) : (
                <span key={j}>{part}</span>
            )
        );
        return (
            <span key={i} style={{ display: "block", marginBottom: lines.length > 1 ? "2px" : 0 }}>
                {rendered}
            </span>
        );
    });
}

export default function HelpBot() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    function reset() {
        setMessages([INITIAL_MESSAGE]);
        setInput("");
        setLoading(false);
        setShowSuggestions(true);
    }

    async function send(text: string) {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        setShowSuggestions(false);
        setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
        setInput("");
        setLoading(true);

        try {
            const res = await axiosDefault.post<{ answer: string }>("/helpbot/chat", {
                message: trimmed,
            });
            setMessages((prev) => [...prev, { role: "bot", text: res.data.answer }]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "bot", text: "Sorry, I couldn't reach the server. Please try again in a moment." },
            ]);
        } finally {
            setLoading(false);
        }
    }

    function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") send(input);
    }

    const iconBtn: React.CSSProperties = {
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
        flexShrink: 0,
        transition: "background 0.12s",
    };

    return (
        <>
            {/* Floating toggle button — always visible */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Close help chat" : "Open help chat"}
                style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    zIndex: 9999,
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    background: "var(--color-primary)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
                    transition: "transform 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-primary-hover)")
                }
                onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-primary)")
                }
            >
                {open ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M4 4l12 12M16 4L4 16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>

            {/* Chat panel */}
            {open && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "88px",
                        right: "24px",
                        zIndex: 9998,
                        width: "360px",
                        maxWidth: "calc(100vw - 32px)",
                        height: "520px",
                        maxHeight: "calc(100vh - 120px)",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "16px",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        animation: "helpbot-slide-up 0.2s ease",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "12px 14px",
                            borderBottom: "1px solid var(--color-border)",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            background: "var(--color-surface)",
                            flexShrink: 0,
                        }}
                    >
                        {/* Avatar */}
                        <div
                            style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: "var(--color-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        {/* Title */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    color: "var(--color-text)",
                                }}
                            >
                                Help Assistant
                            </p>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: "10px",
                                    color: "var(--color-text-muted)",
                                    letterSpacing: "0.05em",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                Shelf Intelligence Support
                            </p>
                        </div>

                        {/* Reset / back-to-start button */}
                        <button
                            onClick={reset}
                            aria-label="Reset conversation"
                            title="Back to start"
                            style={iconBtn}
                            onMouseEnter={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-muted)")
                            }
                            onMouseLeave={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                            }
                        >
                            {/* Refresh/reset icon */}
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                    d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        {/* Close button */}
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close chat"
                            title="Close"
                            style={iconBtn}
                            onMouseEnter={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-muted)")
                            }
                            onMouseLeave={(e) =>
                                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                            }
                        >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                        }}
                    >
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: "85%",
                                        padding: "10px 13px",
                                        borderRadius:
                                            msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                        background:
                                            msg.role === "user"
                                                ? "var(--color-primary)"
                                                : "var(--color-surface-muted)",
                                        border: msg.role === "bot" ? "1px solid var(--color-border)" : "none",
                                        fontSize: "13px",
                                        lineHeight: "1.55",
                                        color: msg.role === "user" ? "#fff" : "var(--color-text)",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {msg.role === "bot" ? renderAnswer(msg.text) : msg.text}
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "14px 14px 14px 4px",
                                        background: "var(--color-surface-muted)",
                                        border: "1px solid var(--color-border)",
                                        display: "flex",
                                        gap: "4px",
                                        alignItems: "center",
                                    }}
                                >
                                    {[0, 1, 2].map((dot) => (
                                        <span
                                            key={dot}
                                            style={{
                                                width: "6px",
                                                height: "6px",
                                                borderRadius: "50%",
                                                background: "var(--color-text-muted)",
                                                display: "inline-block",
                                                animation: `helpbot-bounce 1s ease-in-out ${dot * 0.15}s infinite`,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Suggestion chips */}
                        {showSuggestions && !loading && (
                            <div style={{ marginTop: "4px" }}>
                                <p
                                    style={{
                                        fontSize: "10px",
                                        color: "var(--color-text-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.1em",
                                        margin: "0 0 8px 0",
                                    }}
                                >
                                    Suggested questions
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => send(s)}
                                            style={{
                                                padding: "5px 10px",
                                                borderRadius: "20px",
                                                border: "1px solid var(--color-primary)",
                                                background: "transparent",
                                                color: "var(--color-primary)",
                                                fontSize: "11px",
                                                cursor: "pointer",
                                                transition: "background 0.12s, color 0.12s",
                                                fontWeight: 600,
                                                letterSpacing: "0.02em",
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLButtonElement).style.background =
                                                    "var(--color-primary)";
                                                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLButtonElement).style.background =
                                                    "transparent";
                                                (e.currentTarget as HTMLButtonElement).style.color =
                                                    "var(--color-primary)";
                                            }}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div
                        style={{
                            padding: "12px",
                            borderTop: "1px solid var(--color-border)",
                            display: "flex",
                            gap: "8px",
                            background: "var(--color-surface)",
                            flexShrink: 0,
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Ask a question..."
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: "9px 13px",
                                borderRadius: "10px",
                                border: "1px solid var(--color-border-input)",
                                background: "var(--color-surface-muted)",
                                color: "var(--color-text)",
                                fontSize: "13px",
                                outline: "none",
                                transition: "border-color 0.15s",
                            }}
                            onFocus={(e) =>
                                ((e.target as HTMLInputElement).style.borderColor = "var(--color-primary)")
                            }
                            onBlur={(e) =>
                                ((e.target as HTMLInputElement).style.borderColor = "var(--color-border-input)")
                            }
                        />
                        <button
                            onClick={() => send(input)}
                            disabled={loading || !input.trim()}
                            aria-label="Send message"
                            style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "10px",
                                background:
                                    loading || !input.trim() ? "var(--color-border)" : "var(--color-primary)",
                                border: "none",
                                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                transition: "background 0.15s",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes helpbot-slide-up {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes helpbot-bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40%           { transform: translateY(-5px); }
                }
            `}</style>
        </>
    );
}
