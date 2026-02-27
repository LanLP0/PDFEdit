import type { ElectronAPI } from '../../electron/preload';

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

/** True when running inside an Electron shell (desktop). */
export const isElectron: boolean =
    typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

/** Type-safe accessor for the Electron API. Throws if called outside Electron. */
export function getElectronAPI(): ElectronAPI {
    if (!window.electronAPI) {
        throw new Error('electronAPI is not available outside of Electron.');
    }
    return window.electronAPI;
}
