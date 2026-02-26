import { useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { usePDFStore } from '../../store/usePDFStore';
import { AnnotationOverlay } from '../Annotations/AnnotationOverlay';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    pageId: string;
    zoom: number;
}

export function PdfViewer({ pageId, zoom }: PdfViewerProps) {
    const { document } = usePDFStore();

    const originalPageIndex = useMemo(() => {
        return parseInt(pageId.split('-')[1], 10);
    }, [pageId]);

    const rotation = document.modifications.rotations[pageId] || 0;

    // Calculate width based on zoom (base width = 612px ≈ standard US Letter)
    const pageWidth = Math.round(612 * (zoom / 100));

    // Memoize file URL to prevent Document re-mounts
    const fileUrl = useMemo(() => {
        if (!document.originalBytes) return null;
        const blob = new Blob([document.originalBytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    }, [document.originalBytes]);

    if (!fileUrl) return null;

    return (
        <div className="relative shadow-md bg-white">
            <Document
                file={fileUrl}
                loading={
                    <div style={{ width: pageWidth, height: pageWidth * 1.3 }} className="flex items-center justify-center text-[var(--color-text-muted)] bg-white">
                        Loading...
                    </div>
                }
            >
                <Page
                    pageNumber={originalPageIndex}
                    rotate={rotation}
                    width={pageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                />
            </Document>

            <div className="absolute top-0 left-0 w-full h-full z-10">
                <AnnotationOverlay pageId={pageId} />
            </div>
        </div>
    );
}
