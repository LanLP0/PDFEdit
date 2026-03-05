/**
 * Read the existing PDF outline (table of contents / bookmarks) using pdfjs-dist.
 * Returns a tree of OutlineItem objects with page IDs resolved from destinations.
 */
import { pdfjs } from 'react-pdf';
import type { OutlineItem, Bookmark } from '../../store/usePDFStore';

/**
 * Read user bookmarks from custom metadata stored by PDFEdit.
 * Stored in PDF keywords as "pdfedit-bookmarks:{base64}" to avoid comma issues.
 */
export async function readBookmarkMetadata(pdfBytes: ArrayBuffer): Promise<Bookmark[]> {
    try {
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
        const keywords = doc.getKeywords();
        if (!keywords) return [];

        const prefix = 'pdfedit-bookmarks:';
        // Keywords is a single string — find the prefix directly
        const idx = keywords.indexOf(prefix);
        if (idx < 0) return [];

        const b64 = keywords.slice(idx + prefix.length).split(',')[0].trim();
        const json = decodeURIComponent(escape(atob(b64)));
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed as Bookmark[];
    } catch (e) {
        console.warn('Failed to read bookmark metadata:', e);
    }
    return [];
}

interface PdfjsOutlineItem {
    title: string;
    bold: boolean;
    italic: boolean;
    color: Uint8ClampedArray;
    dest: string | any[] | null;
    url: string | null;
    unsafeUrl: string | undefined;
    newWindow: boolean | undefined;
    count: number | undefined;
    items: PdfjsOutlineItem[];
}

/**
 * Read the outline from a PDF loaded in pdfjs-dist.
 * @param pdfBytes The raw PDF bytes
 * @param pageOrder The current page order IDs (e.g. ["page-1", "page-2", ...])
 */
export async function readOutline(pdfBytes: ArrayBuffer, pageOrder: string[]): Promise<OutlineItem[]> {
    const loadingTask = pdfjs.getDocument({ data: pdfBytes });
    const pdfDoc = await loadingTask.promise;

    try {
        const outline = await pdfDoc.getOutline() as PdfjsOutlineItem[] | null;
        if (!outline || outline.length === 0) return [];

        return await resolveOutlineItems(pdfDoc, outline, pageOrder);
    } finally {
        pdfDoc.destroy();
    }
}

async function resolveOutlineItems(
    pdfDoc: any,
    items: PdfjsOutlineItem[],
    pageOrder: string[],
): Promise<OutlineItem[]> {
    const result: OutlineItem[] = [];

    for (const item of items) {
        let pageId = pageOrder[0]; // fallback to first page

        if (item.dest) {
            try {
                let dest = item.dest;
                // Named destinations need to be resolved first
                if (typeof dest === 'string') {
                    dest = await pdfDoc.getDestination(dest);
                }
                if (Array.isArray(dest) && dest.length > 0) {
                    const ref = dest[0];
                    const pageIndex = await pdfDoc.getPageIndex(ref);
                    if (pageIndex >= 0 && pageIndex < pageOrder.length) {
                        pageId = pageOrder[pageIndex];
                    }
                }
            } catch {
                // Destination couldn't be resolved — keep fallback
            }
        }

        const children = item.items?.length > 0
            ? await resolveOutlineItems(pdfDoc, item.items, pageOrder)
            : [];

        result.push({ title: item.title, pageId, children });
    }

    return result;
}
