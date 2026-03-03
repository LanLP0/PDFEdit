import Modal from 'react-modal';
import { X, AlertTriangle, HelpCircle } from 'lucide-react';

// Set the app element for accessibility
if (typeof window !== 'undefined' && document.getElementById('root')) {
    Modal.setAppElement('#root');
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'primary' | 'danger' | 'warning';
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary'
}: ConfirmationModalProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-red-500 hover:bg-red-600 text-white';
            case 'warning':
                return 'bg-amber-500 hover:bg-amber-600 text-white';
            default:
                return 'bg-primary hover:opacity-90 text-white';
        }
    };

    const getIcon = () => {
        switch (variant) {
            case 'danger':
            case 'warning':
                return <AlertTriangle className={variant === 'danger' ? 'text-red-500' : 'text-amber-500'} size={24} />;
            default:
                return <HelpCircle className="text-primary" size={24} />;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel={title}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-(--color-bg-panel) border border-(--color-border) rounded-2xl shadow-(--shadow-floating) p-6 w-full max-w-md outline-none"
            overlayClassName="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
            closeTimeoutMS={200}
        >
            <div className="relative">
                <button
                    onClick={onClose}
                    className="absolute -top-2 -right-2 p-1 rounded-full text-(--color-text-muted) hover:text-(--color-text-main) hover:bg-(--color-bg-hover) transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex items-start gap-4 mb-6">
                    <div className="shrink-0 mt-1">
                        {getIcon()}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-(--color-text-main) mb-1">{title}</h2>
                        <p className="text-sm text-(--color-text-muted) leading-relaxed truncate">
                            {description}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-8">
                    <button
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main) transition-all"
                        onClick={onClose}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all shadow-sm ${getVariantStyles()}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
