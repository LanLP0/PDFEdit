import { usePDFStore } from '../store/usePDFStore';
import { addRecentFile } from './recentFiles';
import type { RecentFileEntry } from './recentFiles';

/**
 * Check whether the currently loaded document has any modifications.
 */
export function hasModifications(): boolean {
    const state = usePDFStore.getState();
    const mods = state.document.modifications;
    return (
        Object.keys(mods.rotations).length > 0 ||
        Object.keys(mods.annotations).length > 0 ||
        mods.deletedPages.length > 0
    );
}

/**
 * Common file-open handler. Opens the PDF in the current tab if no document
 * is loaded or the current document has no modifications. Otherwise prompts
 * the user to discard changes or open in a new tab.
 *
 * Designed to be the single entry-point for opening PDFs so it can be
 * extended when the app moves to a desktop framework.
 */
export async function openFile(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    try {
        const buffer = await file.arrayBuffer();
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
        const numPages = pdfDoc.getPageCount();
        const initialPages = Array.from({ length: numPages }, (_, i) => `page-${i + 1}`);

        const state = usePDFStore.getState();
        const hasDoc = !!state.document.originalBytes;

        if (hasDoc && hasModifications()) {
            // Document is open with changes — ask user
            const action = window.confirm(
                'You have unsaved changes. Click OK to discard and open the new file, or Cancel to abort.',
            );
            if (!action) return;
        }

        // Load the document (replaces current)
        state.loadDocument(file, buffer, initialPages);

        // Record in recent files
        const entry: RecentFileEntry = {
            id: `${file.name}-${file.size}`,
            name: file.name,
            size: file.size,
            lastOpened: Date.now(),
            pageCount: numPages,
        };
        await addRecentFile(entry);
    } catch (e) {
        console.error('Failed to open file', e);
        alert('Error loading PDF.');
    }
}
