import Modal from 'react-modal';
import { X, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { isElectron } from '../../lib/electron';

interface FileConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDiscardAndOpen: () => void;
    onOpenInNewWindow: () => void;
    fileName: string;
}

export function FileConflictModal({
    isOpen,
    onClose,
    onDiscardAndOpen,
    onOpenInNewWindow,
    fileName
}: FileConflictModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel="Unsaved Changes Conflict"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-(--color-bg-panel) rounded-xl shadow-(--shadow-floating) max-w-md w-full p-6 outline-none"
            overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            closeTimeoutMS={200}
        >
            <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                    <AlertTriangle className="text-amber-600" size={32} />
                </div>

                <h2 className="text-xl font-bold text-(--color-text-main) mb-2">Unsaved Changes</h2>
                <p className="text-sm text-(--color-text-muted) mb-6">
                    You're opening <span className="font-semibold text-(--color-text-main)">"{fileName}"</span>, but your current document has unsaved changes.
                </p>

                <div className="w-full space-y-3">
                    <button
                        onClick={onDiscardAndOpen}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-(--color-border) hover:border-red-600 hover:bg-red-600 hover:text-white group transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                                <X size={18} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-(--color-text-main)">Discard & Open</div>
                                <div className="text-xs text-(--color-text-muted) group-hover:text-(--color-text-main) transition-colors">Lose current unsaved edits</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-(--color-text-muted) group-hover:text-(--color-text-main) transition-colors" />
                    </button>

                    {isElectron && (
                        <button
                            onClick={onOpenInNewWindow}
                            className="w-full flex items-center justify-between p-4 rounded-xl border border-(--color-border) hover:border-primary hover:bg-primary/5 group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-primary">
                                    <FileText size={18} />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-(--color-text-main)">Open in New Window</div>
                                    <div className="text-xs text-(--color-text-muted)">Keep current work open</div>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-(--color-text-muted) group-hover:text-primary transition-colors" />
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3 text-sm font-medium text-(--color-text-muted) hover:text-(--color-text-main) transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
}
