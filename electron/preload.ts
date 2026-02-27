import { contextBridge, ipcRenderer } from 'electron';

export type ElectronAPI = {
    /** Opens the native OS file picker and returns the chosen file path, or null if cancelled. */
    openFileDialog: () => Promise<string | null>;
    /** Opens the native OS save dialog and returns the chosen file path, or null if cancelled. */
    saveFileDialog: (defaultName: string) => Promise<string | null>;
    /** Reads a file from a native path and returns its bytes as an ArrayBuffer. */
    readFile: (filePath: string) => Promise<ArrayBuffer>;
    /** Writes bytes to a native file path. */
    writeFile: (filePath: string, data: ArrayBuffer) => Promise<void>;
    /** The current platform string (e.g. 'win32', 'darwin', 'linux'). */
    platform: NodeJS.Platform;
    /** Register a listener for files opened via File > Open menu or macOS Dock. */
    onOpenFile: (callback: (filePath: string) => void) => () => void;
};

contextBridge.exposeInMainWorld('electronAPI', {
    openFileDialog: (): Promise<string | null> =>
        ipcRenderer.invoke('dialog:openFile'),

    saveFileDialog: (defaultName: string): Promise<string | null> =>
        ipcRenderer.invoke('dialog:saveFile', defaultName),

    readFile: async (filePath: string): Promise<ArrayBuffer> => {
        const raw = await ipcRenderer.invoke('fs:readFile', filePath) as {
            buffer: ArrayBuffer;
            byteOffset: number;
            byteLength: number;
        };
        return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    },

    writeFile: (filePath: string, data: ArrayBuffer): Promise<void> =>
        ipcRenderer.invoke('fs:writeFile', filePath, data),

    platform: process.platform,

    onOpenFile: (callback: (filePath: string) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
        ipcRenderer.on('open-file', handler);
        // Return a cleanup function
        return () => ipcRenderer.removeListener('open-file', handler);
    },
} satisfies ElectronAPI);
