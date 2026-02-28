import { useEffect, useState } from "react";
import { WavingHandIcon } from "./Icons";

const ConfettiPiece = ({ index }: { index: number }) => {
    const colors = ["bg-primary", "bg-primary/70", "bg-primary/50", "bg-primary/30", "bg-primary/80", "bg-primary/60"];
    const color = colors[index % colors.length];
    const left = `${5 + ((index * 6.5) % 90)}%`;
    const delay = `${(index * 0.15) % 1.5}s`;
    const duration = `${0.8 + (index % 5) * 0.2}s`;
    const isSquare = index % 3 === 0;

    return (
        <div
            className={`absolute top-0 ${color} opacity-0 ${isSquare ? "h-2 w-2 rotate-45" : "h-3 w-1.5 rounded-full"}`}
            style={{ left, animation: `confettiFall ${duration} ease-out ${delay} forwards` }}
        />
    );
};

const LogoutSuccess = ({ firstName, onContinue }: { firstName: string; onContinue: () => void }) => {
    const [step, setStep] = useState(0);
    const [fading, setFading] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setStep(1), 100);
        const t2 = setTimeout(() => setStep(2), 650);
        const t3 = setTimeout(() => setStep(3), 1100);

        return () => [t1, t2, t3].forEach(clearTimeout);
    }, []);

    const handleContinue = () => {
        setFading(true);
        setTimeout(() => onContinue(), 700);
    };

    return (
        <div
            className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-white px-4"
            style={{ transition: "opacity 0.7s ease", opacity: fading ? 0 : 1 }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Instrument+Serif:ital@0;1&display=swap');
                @keyframes confettiFall {
                    0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(200px) rotate(720deg); opacity: 0; }
                }
                @keyframes waveDraw {
                    from { stroke-dashoffset: 80; opacity: 0; }
                    to   { stroke-dashoffset: 0;  opacity: 1; }
                }
                @keyframes ringPulse {
                    0%   { transform: scale(1);   opacity: 0.4; }
                    100% { transform: scale(2.2); opacity: 0;   }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.4); }
                    to   { opacity: 1; transform: scale(1);   }
                }
                @keyframes cardSlide {
                    from { opacity: 0; transform: translateY(28px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1);       }
                }
                @keyframes bgOrb {
                    0%, 100% { transform: translate(-50%, -50%) scale(1);   }
                    50%      { transform: translate(-50%, -50%) scale(1.15); }
                }
                .ls-font-syne       { font-family: 'Syne', sans-serif; }
                .ls-font-instrument { font-family: 'Instrument Serif', serif; }
                .ls-card-animate    { animation: cardSlide 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
                .ls-check-animate   { animation: scaleIn   0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
                .ls-ring-animate    { animation: ringPulse 1.8s ease-out infinite; }
                .ls-t1 { animation: fadeUp 0.5s ease 0s    forwards; }
                .ls-t2 { animation: fadeUp 0.5s ease 0.1s  forwards; }
                .ls-t3 { animation: fadeUp 0.5s ease 0.22s forwards; }
                .ls-t4 { animation: fadeUp 0.5s ease 0.34s forwards; }
                .ls-wave-path {
                    stroke-dasharray: 80;
                    stroke-dashoffset: 80;
                    animation: waveDraw 0.6s ease 0.1s forwards;
                }
                .ls-card-glow {
                    box-shadow: 0 0 0 1px rgba(var(--color-primary), 0.1),
                                0 24px 80px rgba(0,0,0,0.08),
                                0 0 80px rgba(var(--color-primary), 0.06);
                }
                .ls-btn-go {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .ls-btn-go:hover  { transform: translateY(-2px); }
                .ls-btn-go:active { transform: translateY(0); }
            `}</style>

            {/* Background orb */}
            <div
                className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] rounded-full"
                style={{
                    background: "radial-gradient(circle, rgba(var(--color-primary), 0.05) 0%, transparent 65%)",
                    animation: "bgOrb 7s ease-in-out infinite",
                    transform: "translate(-50%, -50%)",
                }}
            />

            {/* Dot grid */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                    maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)",
                }}
            />

            {/* Card */}
            <div
                className={`ls-card-glow relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white ${step >= 1 ? "ls-card-animate" : "opacity-0"}`}
            >
                {/* Confetti */}
                {step >= 3 && (
                    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                        {Array.from({ length: 18 }, (_, i) => (
                            <ConfettiPiece key={i} index={i} />
                        ))}
                    </div>
                )}

                {/* Top accent */}
                <div className="bg-primary h-1 w-full rounded-t-3xl" />

                <div className="flex flex-col items-center px-10 py-12 text-center">
                    {/* Wave / bye icon */}
                    <div className="relative mb-9">
                        {step >= 2 && (
                            <>
                                <div className="ls-ring-animate border-primary/30 absolute inset-0 rounded-full border" />
                                <div
                                    className="ls-ring-animate border-primary/15 absolute inset-0 rounded-full border"
                                    style={{ animationDelay: "0.5s" }}
                                />
                            </>
                        )}
                        <div
                            className={`border-primary/20 bg-primary/10 relative flex h-20 w-20 items-center justify-center rounded-full border ${step >= 2 ? "ls-check-animate" : "opacity-0"}`}
                            style={{ boxShadow: "0 0 40px rgba(var(--color-primary), 0.15)" }}
                        >
                            {/* Waving hand icon */}
                            <WavingHandIcon />
                        </div>
                    </div>

                    {step >= 3 && (
                        <>
                            <p className="ls-t1 ls-font-syne text-primary/60 mb-3 text-[11px] font-semibold tracking-[0.22em] uppercase opacity-0">
                                Logged Out
                            </p>
                            <h1 className="ls-t2 ls-font-instrument mb-1 text-[2.6rem] leading-tight text-gray-800 opacity-0">
                                See you soon,
                            </h1>
                            <h2 className="ls-t2 ls-font-instrument text-primary mb-5 text-[2.6rem] leading-tight italic opacity-0">
                                {firstName}.
                            </h2>
                            <p className="ls-t3 ls-font-syne mb-9 max-w-xs text-sm leading-relaxed text-gray-400 opacity-0">
                                You've been safely logged out. Your session has ended.
                            </p>
                            <div className="ls-t4 w-full opacity-0">
                                <button
                                    onClick={handleContinue}
                                    className="ls-btn-go ls-font-syne bg-primary hover:bg-primary/90 w-full rounded-xl py-3.5 text-sm font-semibold text-white"
                                >
                                    Back to Login →
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogoutSuccess;
