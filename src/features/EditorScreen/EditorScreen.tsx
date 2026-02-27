import { useState, useRef, useCallback, useEffect } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import { PdfViewer } from './PdfViewer';
import { SignatureModal } from '../Annotations/SignatureModal';
import { ChevronLeft, ChevronRight, RotateCw, Trash2, FilePlus, ZoomIn, ZoomOut } from 'lucide-react';

interface EditorScreenProps {
    visiblePageIndex: number;
    setVisiblePageIndex: (idx: number) => void;
}

export function EditorScreen({ visiblePageIndex, setVisiblePageIndex }: EditorScreenProps) {
    const { document, settings, rotatePage, deletePage, setZoom } = usePDFStore();
    const mergeInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [pageInput, setPageInput] = useState('');
    const [zoomInput, setZoomInput] = useState(String(settings.zoom));
    // Track whether the index change came from scrolling or from external (e.g. sidebar)
    const closestIdx = useRef(0);
    // const pendingScrollIdx = useRef<number | null>(null);

    const order = document.modifications.pageOrder;
    const totalPages = order.length;
    const currentPageId = order[visiblePageIndex] || null;

    useEffect(() => { setZoomInput(String(settings.zoom)); }, [settings.zoom]);

    // When visiblePageIndex changes externally (sidebar click), scroll to that page
    useEffect(() => {
        if (visiblePageIndex === closestIdx.current) return;
        scrollToPage(visiblePageIndex);
    }, [visiblePageIndex, order]);

    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const containerCenter = container.scrollTop + container.clientHeight / 3;
        closestIdx.current = 0;
        let closestDist = Infinity;
        order.forEach((pageId, idx) => {
            const el = pageRefs.current[pageId];
            if (!el) return;
            const elCenter = el.offsetTop + el.offsetHeight / 2;
            const dist = Math.abs(containerCenter - elCenter);
            if (dist < closestDist) { closestDist = dist; closestIdx.current = idx; }
        });
        setVisiblePageIndex(closestIdx.current);
    }, [order, setVisiblePageIndex]);

    const scrollToPage = (idx: number) => {
        if (idx < 0 || idx >= totalPages) return;
        const el = pageRefs.current[order[idx]];
        if (el && scrollContainerRef.current) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        setVisiblePageIndex(idx);
    };

    const handleRotate = () => { if (currentPageId) rotatePage(currentPageId, 90); };
    const handleDeletePage = () => {
        if (!currentPageId || totalPages <= 1) return;
        if (!confirm(`Delete page ${visiblePageIndex + 1}?`)) return;
        deletePage(currentPageId);
    };

    const handleMergeFile = async (file: File) => {
        try {
            const buffer = await file.arrayBuffer();
            const { PDFDocument } = await import('pdf-lib');
            const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
            const numPages = pdfDoc.getPageCount();

            const currentBytes = usePDFStore.getState().document.originalBytes;
            if (!currentBytes) return;

            const originalPdf = await PDFDocument.load(currentBytes);
            const currentPageCount = originalPdf.getPageCount();

            const mergePdf = await PDFDocument.load(buffer);
            const copiedPages = await originalPdf.copyPages(mergePdf, mergePdf.getPageIndices());
            copiedPages.forEach((page) => originalPdf.addPage(page));
            const mergedBytes = await originalPdf.save();

            // Create page IDs using the format "page-N" where N is 1-based index
            // in the combined PDF. This way the export function can correctly find them.
            const newPageIds = Array.from({ length: numPages }, (_, i) => `page-${currentPageCount + i + 1}`);

            usePDFStore.setState((state) => ({
                document: {
                    ...state.document,
                    originalBytes: mergedBytes.buffer as ArrayBuffer,
                    modifications: {
                        ...state.document.modifications,
                        pageOrder: [...state.document.modifications.pageOrder, ...newPageIds]
                    }
                }
            }));

            // Reset the file input so the same file can be merged again
            if (mergeInputRef.current) mergeInputRef.current.value = '';
        } catch (e) { console.error("Merge failed:", e); alert("Failed to merge PDF"); }
    };

    const handlePageInputSubmit = () => {
        const num = parseInt(pageInput, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) scrollToPage(num - 1);
        setPageInput('');
    };
    const handleZoomInputSubmit = () => {
        const num = parseInt(zoomInput, 10);
        if (!isNaN(num) && num >= 25 && num <= 400) setZoom(num);
        else setZoomInput(String(settings.zoom));
    };

    return (
        <div className="flex-1 w-full h-full bg-[var(--color-canvas)] flex flex-col overflow-hidden relative">
            {/* Vertically scrolling PDF Canvas */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-[var(--color-canvas)]" onScroll={handleScroll}>
                <div className="flex flex-col items-center gap-6 py-10 px-4">
                    {order.map((pageId) => (
                        <div key={pageId} ref={(el) => { pageRefs.current[pageId] = el; }}>
                            <PdfViewer pageId={pageId} zoom={settings.zoom} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Floating Bottom Card */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-floating)] px-4 py-2.5 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <button className="btn-icon p-1.5" onClick={() => scrollToPage(visiblePageIndex - 1)} disabled={visiblePageIndex <= 0}><ChevronLeft size={18} /></button>
                    <span className="text-sm font-medium text-[var(--color-text-main)] tabular-nums">
                        <input type="text" className="w-12 text-center text-sm px-1 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
                            placeholder={String(visiblePageIndex + 1)} value={pageInput} onChange={(e) => setPageInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); }} onBlur={handlePageInputSubmit} title="Jump to page" />
                        &nbsp;/&nbsp;{totalPages}
                    </span>
                    <button className="btn-icon p-1.5" onClick={() => scrollToPage(visiblePageIndex + 1)} disabled={visiblePageIndex >= totalPages - 1}><ChevronRight size={18} /></button>
                </div>
                {/* <div className="flex items-center gap-1.5">
                    <button className="btn-icon p-1.5" onClick={() => scrollToPage(visiblePageIndex - 1)} disabled={visiblePageIndex <= 0}><ChevronLeft size={18} /></button>
                    <span className="text-sm font-medium text-[var(--color-text-main)] tabular-nums">Page {visiblePageIndex + 1} / {totalPages}</span>
                    <button className="btn-icon p-1.5" onClick={() => scrollToPage(visiblePageIndex + 1)} disabled={visiblePageIndex >= totalPages - 1}><ChevronRight size={18} /></button>
                    <input type="text" className="w-12 text-center text-sm px-1 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
                        placeholder="#" value={pageInput} onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); }} onBlur={handlePageInputSubmit} title="Jump to page" />
                </div> */}
                <div className="w-px h-6 bg-[var(--color-border)]"></div>
                <div className="flex items-center gap-1">
                    <button className="btn-icon p-1.5" onClick={handleRotate} title="Rotate 90°"><RotateCw size={16} /></button>
                    <button className="btn-icon p-1.5" onClick={handleDeletePage} title="Delete page" disabled={totalPages <= 1}><Trash2 size={16} /></button>
                    <button className="btn-icon p-1.5" onClick={() => mergeInputRef.current?.click()} title="Merge PDF"><FilePlus size={16} /></button>
                    <input type="file" accept="application/pdf" className="hidden" ref={mergeInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMergeFile(f); }} />
                </div>
                <div className="w-px h-6 bg-[var(--color-border)]"></div>
                <div className="flex items-center gap-1.5">
                    <button className="btn-icon p-1.5" onClick={() => setZoom(settings.zoom - 10)} title="Zoom Out"><ZoomOut size={16} /></button>
                    <input type="text" className="w-14 text-center text-sm px-1 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] tabular-nums"
                        value={zoomInput} onChange={(e) => setZoomInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleZoomInputSubmit(); }} onBlur={handleZoomInputSubmit} title="Zoom %" />
                    <span className="text-xs text-[var(--color-text-muted)]">%</span>
                    <button className="btn-icon p-1.5" onClick={() => setZoom(settings.zoom + 10)} title="Zoom In"><ZoomIn size={16} /></button>
                </div>
            </div>

            <SignatureModal pageId={currentPageId} />
        </div>
    );
}
