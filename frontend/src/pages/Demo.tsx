import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiAnalyzeShelf } from "../api/query/shelfAnalysis";
import imgA from "../assets/images/franki-chamaki-wkvKZR4e2OI-unsplash.png";
import imgB from "../assets/images/Screenshot 2026-04-13 at 12.36.04 AM.png";
import imgC from "../assets/images/Screenshot 2026-04-13 at 10.42.26 PM.png";

interface DemoImage {
    url: string;
    label: string;
    filename: string;
}

const DEMO_IMAGES: DemoImage[] = [
    { url: imgA, label: "Shelf Sample 1", filename: "shelf-sample-1.png" },
    { url: imgB, label: "Shelf Sample 2", filename: "shelf-sample-2.png" },
    { url: imgC, label: "Grocery Shelf", filename: "grocery-shelf.png" },
];

const urlToFile = async (url: string, filename: string): Promise<File> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
};

const Demo = () => {
    const navigate = useNavigate();
    const [selected, setSelected] = useState<DemoImage | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState("");

    const handleSelect = (img: DemoImage) => {
        setSelected(img);
        setError("");
    };

    const handleAnalyze = async () => {
        if (!selected) return;
        try {
            setLoading(true);
            setError("");
            setUploadProgress(0);

            const file = await urlToFile(selected.url, selected.filename);
            await apiAnalyzeShelf(file, (percent) => setUploadProgress(percent));

            navigate("/shelf-detection");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analysis failed.");
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="px-8 py-6">
            <header className="mb-6">
                <h1 className="text-3xl font-semibold">Demo</h1>
                <p className="text-text-muted mt-0.5 text-sm">
                    Pick a shelf image and run the AI detection — results will appear in the Shelf Detection tab.
                </p>
            </header>

            {/* Step 1: Image picker */}
            <div className="bg-surface mb-6 rounded-xl p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold">Select a shelf image</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {DEMO_IMAGES.map((img) => {
                        const isSelected = selected?.filename === img.filename;
                        return (
                            <button
                                key={img.filename}
                                type="button"
                                onClick={() => handleSelect(img)}
                                disabled={loading}
                                className={`group overflow-hidden rounded-2xl border-2 text-left transition disabled:opacity-50 ${
                                    isSelected ? "border-primary" : "border-border hover:border-primary/50"
                                }`}
                            >
                                <div className="relative aspect-video w-full overflow-hidden bg-black">
                                    <img
                                        src={img.url}
                                        alt={img.label}
                                        className="h-full w-full object-cover transition group-hover:scale-105"
                                    />
                                    {isSelected && (
                                        <div className="bg-primary absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow">
                                            Selected
                                        </div>
                                    )}
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-text-secondary text-sm font-semibold">{img.label}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-surface rounded-xl p-6 shadow">
                <h2 className="mb-4 text-lg font-semibold">Run the detection</h2>

                <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={!selected || loading}
                    className="bg-primary hover:bg-primary-hover rounded-2xl px-6 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                    {loading ? "Uploading…" : "Run Detection →"}
                </button>

                {loading && (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-text-secondary">Uploading</span>
                            <span className="text-text-muted">{uploadProgress}%</span>
                        </div>
                        <div className="bg-surface-muted h-2 w-full overflow-hidden rounded-full">
                            <div
                                className="bg-status-info-text h-full rounded-full transition-all duration-200 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="border-status-missing-bg bg-status-missing-bg text-status-missing-text mt-4 rounded-2xl border px-4 py-3 text-sm font-medium">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Demo;
