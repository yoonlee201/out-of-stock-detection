const Loading = ({ fullscreen = true, message = "Loading..." }: { fullscreen?: boolean; message?: string }) => {
    return (
        <div
            className={`bg-background flex flex-col items-center justify-center gap-4 ${
                fullscreen ? "h-screen w-screen" : "h-screen w-full"
            }`}
        >
            {/* Spinner */}
            <div className="relative flex h-14 w-14 items-center justify-center">
                {/* Track ring */}
                <svg className="absolute" width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                </svg>
                {/* Spinning arc */}
                <svg className="loading-ring absolute" width="56" height="56" viewBox="0 0 56 56">
                    <circle
                        cx="28"
                        cy="28"
                        r="22"
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
                <div className="loading-dot-1 bg-primary h-2 w-2 rounded-full" />
            </div>

            {/* Dots + text */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1.5">
                    <div className="loading-dot-1 bg-primary/60 h-1.5 w-1.5 rounded-full" />
                    <div className="loading-dot-2 bg-primary/60 h-1.5 w-1.5 rounded-full" />
                    <div className="loading-dot-3 bg-primary/60 h-1.5 w-1.5 rounded-full" />
                </div>
                {message && (
                    <p className="loading-text text-text-muted text-xs font-medium tracking-widest uppercase">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default Loading;
