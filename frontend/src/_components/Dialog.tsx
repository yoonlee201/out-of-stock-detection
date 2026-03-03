import React from "react";

interface DialogProps {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: React.ReactNode;
}

const Dialog = ({ open, title, description, onClose, children }: DialogProps) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold text-gray-900">{title}</h2>
                {description && <p className="mb-5 text-sm text-gray-500">{description}</p>}
                {children}
            </div>
        </div>
    );
};

export default Dialog;
