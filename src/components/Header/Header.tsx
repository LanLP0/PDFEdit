import { Download, Upload, Moon, Sun, Monitor } from 'lucide-react';
import { usePDFStore } from '../../store/usePDFStore';
import { PdfEngine } from '../../lib/pdf/PdfEngine';
import { useState } from 'react';

export function Header() {
    const { document, settings, setTheme, closeDocument } = usePDFStore();
    const [isExporting, setIsExporting] = useState(false);

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
            a.download = `Exported_${document.originalFile?.name || 'Document.pdf'}`;
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
                {document.originalFile && (
                    <div className="text-sm px-3 py-1 bg-[var(--color-bg-app)] rounded-md border border-[var(--color-border)] font-medium text-[var(--color-text-main)] shadow-sm">
                        {document.originalFile.name}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button onClick={handleThemeCycle} className="btn-icon" title={`Theme: ${settings.theme}`}>
                    <ThemeIcon size={20} />
                </button>
                {document.originalFile && (
                    <>
                        <button onClick={closeDocument} className="btn-secondary">
                            <Upload size={16} />
                            Open Another
                        </button>
                        <button className="btn-primary flex items-center gap-2" onClick={handleExport} disabled={isExporting}>
                            <Download size={16} />
                            {isExporting ? 'Exporting...' : 'Export'}
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
