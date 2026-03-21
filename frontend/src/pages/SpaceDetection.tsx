import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { apiDetectSpaces, type SpaceDetectionResponse } from "../api/query/spaceDetection";
import Sidebar from "../_components/Sidebar";

const SpaceDetection = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [confidence, setConfidence] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [result, setResult] = useState<SpaceDetectionResponse | null>(null);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl("");
            return;
        }

        const objectUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedFile]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setSelectedFile(file);
        setErrorMessage("");
        setResult(null);
    };

    const handleDetectSpaces = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedFile) {
            setErrorMessage("Please choose an image first.");
            return;
        }

        let parsedConfidence: number | undefined;
        if (confidence.trim() !== "") {
            const value = Number(confidence);
            if (Number.isNaN(value) || value <= 0 || value > 1) {
                setErrorMessage("Confidence must be a number between 0 and 1.");
                return;
            }
            parsedConfidence = value;
        }

        setLoading(true);
        setErrorMessage("");
        setResult(null);

        try {
            const detectionResult = await apiDetectSpaces({
                image: selectedFile,
                conf: parsedConfidence,
            });
            setResult(detectionResult);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Detection failed.";
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />

            <div className="flex-1 p-8">
                <h1 className="mb-2 text-3xl font-semibold">Space Detection</h1>
                <p className="mb-8 text-gray-600">
                    Upload a shelf image and run YOLOv8 to detect empty spaces.
                </p>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl bg-white p-6 shadow">
                        <h2 className="mb-4 text-xl font-semibold">Upload Image</h2>
                        <form onSubmit={handleDetectSpaces} className="space-y-4">
                            <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp"
                                onChange={handleFileChange}
                                className="block w-full rounded-md border border-gray-300 p-2 text-sm"
                            />

                            <div>
                                <label htmlFor="confidence" className="mb-1 block text-sm font-medium text-gray-700">
                                    Confidence (0-1, optional)
                                </label>
                                <input
                                    id="confidence"
                                    type="number"
                                    min="0.01"
                                    max="1"
                                    step="0.01"
                                    placeholder="0.25"
                                    value={confidence}
                                    onChange={(event) => setConfidence(event.target.value)}
                                    className="w-full rounded-md border border-gray-300 p-2 text-sm"
                                />
                                <p className="mt-1 text-xs text-gray-500">Leave blank to use backend default (0.25).</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !selectedFile}
                                className="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                                {loading ? "Detecting..." : "Detect Spaces"}
                            </button>
                        </form>

                        {errorMessage && <p className="mt-4 text-sm font-medium text-red-600">{errorMessage}</p>}
                    </div>

                    <div className="rounded-xl bg-white p-6 shadow">
                        <h2 className="mb-4 text-xl font-semibold">Input Preview</h2>
                        {previewUrl ? (
                            <img src={previewUrl} alt="Selected shelf" className="max-h-[420px] w-full rounded-lg object-contain" />
                        ) : (
                            <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-500">
                                No image selected
                            </div>
                        )}
                    </div>
                </div>

                {result && (
                    <div className="mt-8 space-y-6">
                        <div className="rounded-xl bg-white p-6 shadow">
                            <h2 className="mb-4 text-xl font-semibold">Detection Summary</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg bg-blue-50 p-4">
                                    <p className="text-sm text-gray-600">Empty Space Count</p>
                                    <p className="text-2xl font-bold text-blue-700">{result.summary.empty_space_count}</p>
                                </div>
                                <div className="rounded-lg bg-amber-50 p-4">
                                    <p className="text-sm text-gray-600">Estimated Empty Area %</p>
                                    <p className="text-2xl font-bold text-amber-700">
                                        {result.summary.estimated_empty_area_percent}%
                                    </p>
                                </div>
                                <div className="rounded-lg bg-gray-100 p-4">
                                    <p className="text-sm text-gray-600">Model</p>
                                    <p className="text-2xl font-bold text-gray-700">{result.model}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white p-6 shadow">
                            <h2 className="mb-4 text-xl font-semibold">Annotated Output</h2>
                            <img
                                src={result.annotated_image}
                                alt="YOLO detection result"
                                className="max-h-[560px] w-full rounded-lg object-contain"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpaceDetection;
