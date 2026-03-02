import Modal from 'react-modal';
import { X, AlertCircle } from 'lucide-react';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
}

export function ErrorModal({
    isOpen,
    onClose,
    title,
    message
}: ErrorModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel="Application Error"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-(--color-bg-panel) rounded-xl shadow-(--shadow-floating) max-w-sm w-full p-6 outline-none"
            overlayClassName="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            closeTimeoutMS={200}
        >
            <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="text-red-600" size={28} />
                </div>

                <h2 className="text-lg font-bold text-(--color-text-main) mb-2">{title}</h2>
                <p className="text-sm text-(--color-text-muted) mb-6">
                    {message}
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-(--color-bg-app) hover:bg-(--color-bg-hover) text-(--color-text-main) font-semibold rounded-lg border border-(--color-border) transition-all"
                >
                    Close
                </button>
            </div>

            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-(--color-text-muted) hover:text-(--color-text-main) transition-colors"
            >
                <X size={20} />
            </button>
        </Modal>
    );
}
