/**
 * PersistentStorage — centralised sync manager for persisted values.
 *
 * Uses localStorage as the backing store and fires cross-tab syncs via the
 * native `storage` event.
 */

import type { RecentFileEntry } from "./recentFiles";

// ─── Sync strategy types ─────────────────────────────────────────────────────

/** Merge both local and remote values together (e.g. union two lists). */
export interface SyncCombine<T> {
    type: 'combine';
    merge: (local: T, remote: T) => T;
}

/** Keep whichever side has the more-recent `modifiedAt` timestamp. */
export interface SyncMostRecent {
    type: 'most-recent';
}

export type SyncStrategy<T> = SyncCombine<T> | SyncMostRecent;

// ─── SyncedValue ──────────────────────────────────────────────────────────────

export class SyncedValue<TValue, TSyncStrategy extends SyncStrategy<TValue>> {
    private value: TValue;
    private _modifiedAt: number;
    private readonly key: string;
    private readonly strategy: TSyncStrategy;
    private readonly serialize: (v: TValue) => string;
    private readonly deserialize: (s: string) => TValue;
    private listeners: Array<(v: TValue) => void> = [];

    constructor(opts: {
        key: string;
        defaultValue: TValue;
        strategy: TSyncStrategy;
        serialize?: (v: TValue) => string;
        deserialize?: (s: string) => TValue;
    }) {
        this.key = opts.key;
        this.strategy = opts.strategy;
        this.serialize = opts.serialize ?? JSON.stringify;
        this.deserialize = opts.deserialize ?? JSON.parse;

        // Hydrate from storage or use default
        const stored = this.readStorage();
        if (stored) {
            this.value = stored.value;
            this._modifiedAt = stored.modifiedAt;
        } else {
            this.value = opts.defaultValue;
            this._modifiedAt = 0; // never modified
        }
    }

    get(): TValue {
        return this.value;
    }

    set(value: TValue): void {
        this.value = value;
        this._modifiedAt = Date.now();
        this.writeStorage();
        this.notify();
    }

    get modifiedAt(): number {
        return this._modifiedAt;
    }

    /** Subscribe to value changes. Returns an unsubscribe function. */
    subscribe(listener: (v: TValue) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Sync with localStorage using the configured strategy.
     * Default behaviour: merge both ways (syncBothWays).
     */
    sync(): void {
        this.syncBothWays();
    }

    /**
     * Two-way sync: read remote, reconcile using the strategy, write back.
     */
    syncBothWays(): void {
        const remote = this.readStorage();

        if (!remote) {
            // Nothing in storage yet — persist local state
            this.writeStorage();
            return;
        }

        if (this.strategy.type === 'most-recent') {
            if (remote.modifiedAt > this._modifiedAt) {
                // Remote is newer — adopt it
                this.value = remote.value;
                this._modifiedAt = remote.modifiedAt;
                this.notify();
            } else if (this._modifiedAt > remote.modifiedAt) {
                // Local is newer — persist it
                this.writeStorage();
            }
            // Equal timestamps: no-op
        } else if (this.strategy.type === 'combine') {
            const strategy = this.strategy as SyncCombine<TValue>;
            const merged = strategy.merge(this.value, remote.value);
            this.value = merged;
            this._modifiedAt = Math.max(this._modifiedAt, remote.modifiedAt);
            this.writeStorage();
            this.notify();
        }
    }

    /**
     * One-way override: local always wins, overwriting remote.
     */
    syncOverride(): void {
        this.writeStorage();
    }

    // ─── internal helpers ─────────────────────────────────────────────────

    private readStorage(): { value: TValue; modifiedAt: number } | null {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return {
                value: this.deserialize(parsed.data),
                modifiedAt: parsed.modifiedAt ?? 0,
            };
        } catch {
            return null;
        }
    }

    private writeStorage(): void {
        try {
            const envelope = JSON.stringify({
                data: this.serialize(this.value),
                modifiedAt: this._modifiedAt,
            });
            localStorage.setItem(this.key, envelope);
        } catch {
            // Storage full or unavailable — silently fail
        }
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener(this.value);
        }
    }
}

// ─── Static typed instances ──────────────────────────────────────────────────

export const recentFilesSynced = new SyncedValue<RecentFileEntry[], SyncMostRecent>({
    key: 'pdfedit:recentFiles',
    defaultValue: [],
    strategy: { type: 'most-recent' },
});

type ThemeMode = 'light' | 'dark' | 'adaptive';

export const themeSynced = new SyncedValue<ThemeMode, SyncMostRecent>({
    key: 'pdfedit:theme',
    defaultValue: 'adaptive',
    strategy: { type: 'most-recent' },
});

// ─── Storage Manager (singleton) ─────────────────────────────────────────────

class StorageManager {
    private values: SyncedValue<any, any>[] = [];

    constructor() {
        // Cross-tab sync via the storage event
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', () => this.sync());
        }
    }

    register(value: SyncedValue<any, any>): void {
        this.values.push(value);
    }

    /** Sync all registered values. */
    sync(): void {
        for (const v of this.values) {
            v.sync();
        }
    }
}

export const storageManager = new StorageManager();

// Auto-register static instances
storageManager.register(recentFilesSynced);
storageManager.register(themeSynced);
