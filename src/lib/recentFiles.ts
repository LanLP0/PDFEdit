/**
 * Recent files — backed by PersistentStorage (localStorage + cross-tab sync).
 */
import { recentFilesSynced } from './PersistentStorage';

export const MAX_RECENT_FILES = 100;

export type LocationType = 'Web' | 'FileSystem';

export interface RecentFileEntry {
    id: string;
    name: string;
    size: number;
    lastOpened: number; // timestamp
    pageCount: number;
    locationType: LocationType;
    location: string | null;
}

// TODO WARN Currently this logic rely a lot on constantly syncing
// For local browser storage, this is not a problem
// For remote storage, this might became a problem

export async function addRecentFile(entry: RecentFileEntry): Promise<void> {
    recentFilesSynced.sync();
    const current = recentFilesSynced.get();
    const idx = current.findIndex(f => f.id === entry.id);
    if (idx >= 0) {
        const updated = [...current];
        updated[idx] = entry;
        recentFilesSynced.set(updated);
    } else {
        recentFilesSynced.set([entry, ...current].slice(0, MAX_RECENT_FILES));
    }
    recentFilesSynced.sync();
}

export async function getRecentFiles(): Promise<RecentFileEntry[]> {
    return recentFilesSynced.get();
}

export async function removeRecentFile(id: string): Promise<void> {
    recentFilesSynced.sync();
    recentFilesSynced.set(recentFilesSynced.get().filter(f => f.id !== id));
    recentFilesSynced.sync();
}

export function onRecentFilesUpdated(callback: (files: RecentFileEntry[]) => void): () => void {
    return recentFilesSynced.subscribe(callback);
}