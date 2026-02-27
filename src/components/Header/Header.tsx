import { Download, Moon, Sun, Monitor, Undo2, Redo2 } from 'lucide-react';
import { usePDFStore } from '../../store/usePDFStore';
import { PdfEngine } from '../../lib/pdf/PdfEngine';
import { useState, useRef, useEffect } from 'react';

export function Header() {
    const { document, settings, setTheme, closeDocument, renameDocument, undo, redo, canUndo, canRedo } = usePDFStore();
    const [isExporting, setIsExporting] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    const handleThemeCycle = () => {
        if (settings.theme === 'light') setTheme('dark');
        else if (settings.theme === 'dark') setTheme('adaptive');
        else setTheme('light');
    };

    const handleExport = async () => {
        if (!document.originalBytes) return;
        setIsExporting(true);
        try {
            const bytes = await PdfEngine.exportDocument(document);
            const blob = new Blob([bytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = `${document.fileName}${document.fileExtension}`;
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export Failed:", e);
            alert("Failed to export document.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleGoHome = () => {
        if (!document.originalBytes) return;
        const hasModifications =
            Object.keys(document.modifications.rotations).length > 0 ||
            Object.keys(document.modifications.annotations).length > 0 ||
            document.modifications.deletedPages.length > 0;

        if (hasModifications) {
            const answer = window.confirm('You have unsaved changes. Do you want to discard them and go back to the home screen?');
            if (!answer) return;
        }
        closeDocument();
    };

    const startEditing = () => {
        setEditName(document.fileName);
        setIsEditingName(true);
    };

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const finishEditing = () => {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== document.fileName) {
            renameDocument(trimmed);
        }
        setIsEditingName(false);
    };

    const ThemeIcon = settings.theme === 'light' ? Sun : settings.theme === 'dark' ? Moon : Monitor;

    return (
        <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-panel)] shadow-sm z-50 relative">
            <div className="flex items-center gap-4">
                <button
                    className="font-bold text-xl tracking-tight text-primary hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none outline-none"
                    onClick={handleGoHome}
                    title={document.originalBytes ? 'Back to Home' : 'PDFEdit'}
                >
                    PDFEdit
                </button>
                {document.originalBytes && (
                    <div className="flex items-center gap-2">
                        {isEditingName ? (
                            <div className="flex items-center bg-[var(--color-bg-app)] rounded-md border border-[var(--color-primary)] shadow-sm overflow-hidden">
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    className="text-sm px-3 py-1 bg-transparent outline-none text-[var(--color-text-main)] font-medium min-w-[120px]"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={finishEditing}
                                    onKeyDown={(e) => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setIsEditingName(false); }}
                                />
                                <span className="text-sm text-[var(--color-text-muted)] pr-3 select-none">{document.fileExtension}</span>
                            </div>
                        ) : (
                            <button
                                className="text-sm px-3 py-1 bg-[var(--color-bg-app)] rounded-md border border-[var(--color-border)] font-medium text-[var(--color-text-main)] shadow-sm hover:border-[var(--color-primary)] transition-colors cursor-text"
                                onClick={startEditing}
                                title="Click to rename"
                            >
                                {document.fileName}{document.fileExtension}
                            </button>
                        )}

                        {/* Undo / Redo buttons */}
                        <div className="flex items-center gap-1 ml-1">
                            <button
                                className="btn-icon p-1.5"
                                onClick={undo}
                                disabled={!canUndo}
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo2 size={16} />
                            </button>
                            <button
                                className="btn-icon p-1.5"
                                onClick={redo}
                                disabled={!canRedo}
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <Redo2 size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button onClick={handleThemeCycle} className="btn-icon" title={`Theme: ${settings.theme}`}>
                    <ThemeIcon size={20} />
                </button>
                {document.originalBytes && (
                    <button className="btn-primary flex items-center gap-2" onClick={handleExport} disabled={isExporting}>
                        <Download size={16} />
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                )}
            </div>
        </header>
    );
}
