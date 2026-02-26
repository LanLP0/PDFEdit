// IndexedDB wrapper for storing recent file metadata
const DB_NAME = 'pdfedit_db';
const DB_VERSION = 1;
const STORE_NAME = 'recent_files';

export interface RecentFileEntry {
    id: string;
    name: string;
    size: number;
    lastOpened: number; // timestamp
    pageCount: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('lastOpened', 'lastOpened', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function addRecentFile(entry: RecentFileEntry): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getRecentFiles(): Promise<RecentFileEntry[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('lastOpened');
        const request = index.openCursor(null, 'prev'); // newest first
        const results: RecentFileEntry[] = [];

        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor && results.length < 12) {
                results.push(cursor.value as RecentFileEntry);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function removeRecentFile(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
