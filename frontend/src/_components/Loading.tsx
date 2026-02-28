const Loading = ({ fullscreen = true, message = "Loading..." }: { fullscreen?: boolean; message?: string }) => {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-4 bg-white ${fullscreen ? "h-screen w-screen" : "h-full w-full"
                }`}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@500&display=swap');

                @keyframes spin-ring {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1);   opacity: 1; }
                    50%      { transform: scale(0.4); opacity: 0.3; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .loading-ring {
                    animation: spin-ring 1s linear infinite;
                }
                .loading-dot-1 { animation: pulse-dot 1.2s ease-in-out 0s    infinite; }
                .loading-dot-2 { animation: pulse-dot 1.2s ease-in-out 0.2s  infinite; }
                .loading-dot-3 { animation: pulse-dot 1.2s ease-in-out 0.4s  infinite; }
                .loading-text  { animation: fadeIn 0.4s ease forwards; font-family: 'Syne', sans-serif; }
            `}</style>

            {/* Spinner */}
            <div className="relative flex h-14 w-14 items-center justify-center">
                {/* Track ring */}
                <svg className="absolute" width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                </svg>
                {/* Spinning arc */}
                <svg className="loading-ring absolute" width="56" height="56" viewBox="0 0 56 56">
                    <circle
                        cx="28" cy="28" r="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="138"
                        strokeDashoffset="100"
                        className="text-primary"
                    />
                </svg>

                {/* Center dot */}
                <div className="h-2 w-2 rounded-full bg-primary loading-dot-1" />
            </div>

            {/* Dots + text */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1.5">
                    <div className="loading-dot-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                    <div className="loading-dot-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
                    <div className="loading-dot-3 h-1.5 w-1.5 rounded-full bg-primary/60" />
                </div>
                {message && (
                    <p className="loading-text text-xs font-medium tracking-widest uppercase text-gray-400">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default Loading;