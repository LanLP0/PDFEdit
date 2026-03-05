import { usePDFStore } from '../store/usePDFStore';
import { addRecentFile } from './recentFiles';
import type { RecentFileEntry } from './recentFiles';
import { isElectron, getElectronAPI } from './electron';
import { readOutline, readBookmarkMetadata } from './pdf/outlineReader';

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

export interface LoadedPdf {
    name: string;
    size: number;
    buffer: ArrayBuffer;
    pages: string[];
    path?: string;
}

/**
 * Load a PDF from an ArrayBuffer. Internal helper shared by processes.
 * Returns the structured PDF data for the caller to decide when to apply it to the store.
 */
export async function preparePdfBuffer(name: string, size: number, buffer: ArrayBuffer, filePath?: string): Promise<LoadedPdf> {
    const { PDFDocument } = await import('pdf-lib');
    try {
        const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
        const numPages = pdfDoc.getPageCount();
        const initialPages = Array.from({ length: numPages }, (_, i) => `page-${i + 1}`);

        return {
            name,
            size,
            buffer,
            pages: initialPages,
            path: filePath
        };
    } catch (e) {
        console.error('pdf-lib load failed:', e);
        throw new Error('The file appears to be an invalid or corrupted PDF.');
    }
}

/**
 * Apply a prepared PDF to the global store and recent files list.
 */
export async function applyLoadedPdf(pdf: LoadedPdf) {
    const state = usePDFStore.getState();
    state.loadDocument({ name: pdf.name, size: pdf.size } as File, pdf.buffer, pdf.pages);

    // Read outline and bookmarks asynchronously — use COPIES of the buffer
    // because pdfjs.getDocument() transfers ownership and detaches the original.
    const bufferCopyOutline = pdf.buffer.slice(0);
    readOutline(bufferCopyOutline, pdf.pages).then((outline) => {
        usePDFStore.setState((s) => ({ document: { ...s.document, outline } }));
    }).catch((err) => {
        console.warn('Failed to read PDF outline:', err);
    });

    // Restore user bookmarks from custom metadata (round-trip support)
    const bufferCopyMeta = pdf.buffer.slice(0);
    readBookmarkMetadata(bufferCopyMeta).then((bookmarks) => {
        if (bookmarks.length > 0) {
            usePDFStore.setState((s) => ({ document: { ...s.document, bookmarks } }));
        }
    }).catch((err) => {
        console.warn('Failed to read bookmark metadata:', err);
    });

    const entry: RecentFileEntry = {
        id: `${pdf.name}-${pdf.size}`,
        name: pdf.name,
        size: pdf.size,
        lastOpened: Date.now(),
        pageCount: pdf.pages.length,
        locationType: pdf.path ? 'FileSystem' : 'Web',
        location: pdf.path ?? null,
    };
    await addRecentFile(entry);
}

/**
 * Common file-open handler for the web renderer (File object from <input> or drag-drop).
 */
export async function openFile(file: File): Promise<LoadedPdf | null> {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Please select a valid PDF file.');
    }

    const buffer = await file.arrayBuffer();
    return await preparePdfBuffer(file.name, file.size, buffer);
}

/**
 * Opens a PDF by native file system path (Electron only).
 */
export async function openFilePath(filePath: string): Promise<LoadedPdf | null> {
    if (!isElectron) return null;

    const api = getElectronAPI();
    const buffer = await api.readFile(filePath);
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
    return await preparePdfBuffer(fileName, buffer.byteLength, buffer, filePath);
}

/**
 * Handle complex file payouts (bytes + name + path).
 */
export async function openFilePayload(data: { name: string, bytes?: Uint8Array, path?: string }): Promise<LoadedPdf | null> {
    if (data.bytes) {
        // Ensure we have a strictly ArrayBuffer (not SharedArrayBuffer) for pdf-lib
        let buffer: ArrayBuffer;
        if (data.bytes.buffer instanceof ArrayBuffer) {
            buffer = data.bytes.buffer;
        } else {
            // It's a SharedArrayBuffer or similar ArrayBufferLike
            buffer = new ArrayBuffer(data.bytes.byteLength);
            new Uint8Array(buffer).set(data.bytes);
        }
        return await preparePdfBuffer(data.name, data.bytes.byteLength, buffer, data.path);
    } else if (data.path) {
        return await openFilePath(data.path);
    }
    return null;
}

/**
 * Trigger the Electron native file picker.
 */
export async function openFileWithDialog(): Promise<LoadedPdf | null> {
    if (!isElectron) return null;

    const api = getElectronAPI();
    const filePath = await api.openFileDialog();
    if (filePath) {
        return await openFilePath(filePath);
    }
    return null;
}
