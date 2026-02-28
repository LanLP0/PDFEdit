import { usePDFStore } from '../store/usePDFStore';
import { addRecentFile } from './recentFiles';
import type { RecentFileEntry } from './recentFiles';
import { isElectron, getElectronAPI } from './electron';

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
 * Load a PDF from an ArrayBuffer. Internal helper shared by openFile and openFilePath.
 */
async function loadPdfBuffer(name: string, size: number, buffer: ArrayBuffer): Promise<void> {
    console.log('Loading PDF:', name);
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
    const numPages = pdfDoc.getPageCount();
    const initialPages = Array.from({ length: numPages }, (_, i) => `page-${i + 1}`);

    const state = usePDFStore.getState();
    const hasDoc = !!state.document.originalBytes;

    if (hasDoc && hasModifications()) {
        const action = window.confirm(
            'You have unsaved changes. Click OK to discard and open the new file, or Cancel to abort.',
        );
        if (!action) return;
    }

    state.loadDocument({ name, size } as File, buffer, initialPages);

    const entry: RecentFileEntry = {
        id: `${name}-${size}`,
        name,
        size,
        lastOpened: Date.now(),
        pageCount: numPages,
    };
    await addRecentFile(entry);
}

/**
 * Common file-open handler for the web renderer (File object from <input> or drag-drop).
 * Opens the PDF in the current tab if no document is loaded or the current document
 * has no modifications. Otherwise prompts the user to discard changes.
 */
export async function openFile(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    try {
        const buffer = await file.arrayBuffer();
        await loadPdfBuffer(file.name, file.size, buffer);
    } catch (e) {
        console.error('Failed to open file', e);
        alert('Error loading PDF.');
    }
}

/**
 * Opens a PDF by native file system path (Electron only).
 * Uses the Electron preload API to read the file, then invokes the common load flow.
 */
export async function openFilePath(filePath: string): Promise<void> {
    if (!isElectron) {
        console.warn('openFilePath called outside of Electron – ignoring.');
        return;
    }

    try {
        const api = getElectronAPI();
        const buffer = await api.readFile(filePath);
        const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
        await loadPdfBuffer(fileName, buffer.byteLength, buffer);
    } catch (e) {
        console.error('Failed to open file from path', e);
        alert('Error loading PDF.');
    }
}

/**
 * Trigger the Electron native file picker to let the user choose a PDF.
 * Falls back to a no-op in the browser context.
 */
export async function openFileWithDialog(): Promise<void> {
    if (!isElectron) return;

    const api = getElectronAPI();
    const filePath = await api.openFileDialog();
    if (filePath) {
        await openFilePath(filePath);
    }
}
