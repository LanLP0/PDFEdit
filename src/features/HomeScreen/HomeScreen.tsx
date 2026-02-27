import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileText, Clock, File, Trash2 } from 'lucide-react';
import { getRecentFiles, removeRecentFile } from '../../lib/recentFiles';
import type { RecentFileEntry } from '../../lib/recentFiles';
import { openFile } from '../../lib/openFile';

export function HomeScreen() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recentInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const files = await getRecentFiles();
                setRecentFiles(files);
            } catch (e) {
                console.error('Failed to load recent files', e);
            }
        })();
    }, []);

    const handleFileSelect = async (file: File) => {
        await openFile(file);
        // Refresh recent files list after opening
        try {
            const files = await getRecentFiles();
            setRecentFiles(files);
        } catch (_) { /* ignore */ }
    };

    const handleRemoveRecent = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await removeRecentFile(id);
            setRecentFiles(prev => prev.filter(f => f.id !== id));
        } catch (err) {
            console.error('Failed to remove recent file', err);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = () => { setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    return (
        <div className="flex-1 w-full h-full flex flex-col items-center bg-[var(--color-bg-app)] overflow-y-auto px-6 py-12">
            {/* Main Floating Card Dropzone */}
            <div
                className={`max-w-4xl w-full p-10 flex flex-col md:flex-row items-center justify-between rounded-2xl bg-[var(--color-bg-panel)] shadow-[var(--shadow-floating)] transition-all cursor-pointer group mb-12 border-2 border-dashed ${isDragging ? 'border-[var(--color-primary)] bg-[var(--color-bg-hover)]' : 'border-transparent'}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="flex-1 pr-8 mb-8 md:mb-0 text-center md:text-left">
                    <h1 className="text-4xl font-bold mb-4 text-[var(--color-text-main)] tracking-tight">PDFEdit</h1>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <button className="btn-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                            <FileText size={20} />
                            Select a PDF
                        </button>
                    </div>
                </div>
                <div className="w-64 h-64 rounded-xl border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center bg-[var(--color-bg-app)] group-hover:border-[var(--color-primary)] transition-all">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${isDragging ? 'bg-[var(--color-primary)] text-white scale-110' : 'bg-[var(--color-bg-panel)] text-[var(--color-primary)] shadow-sm'}`}>
                        <UploadCloud size={40} />
                    </div>
                    <span className="font-semibold text-[var(--color-text-main)]">Drop PDF Here</span>
                    <span className="text-sm text-[var(--color-text-muted)] mt-1">or click to browse</span>
                </div>
                <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {/* Hidden input for recent file re-opens */}
            <input type="file" accept="application/pdf" className="hidden" ref={recentInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

            {/* Recent Files Grid */}
            <div className="max-w-4xl w-full">
                <div className="flex items-center gap-2 mb-6 text-[var(--color-text-main)]">
                    <Clock size={20} className="text-[var(--color-primary)]" />
                    <h2 className="text-xl font-semibold">Recent Documents</h2>
                </div>

                {recentFiles.length === 0 ? (
                    <div className="text-center py-12 text-[var(--color-text-muted)]">
                        <File size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">No recent documents</p>
                        <p className="text-sm mt-1">Open a PDF to start. Your recent files will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {recentFiles.map((recent) => (
                            <div
                                key={recent.id}
                                className="bg-[var(--color-bg-panel)] rounded-xl p-5 border border-[var(--color-border)] shadow-sm hover:shadow-md hover:border-[var(--color-primary)] transition-all cursor-pointer flex flex-col group/card relative"
                                onClick={() => recentInputRef.current?.click()}
                                title={`Click to re-open ${recent.name}`}
                            >
                                {/* Delete button: top-right corner */}
                                <button
                                    className="absolute top-3 right-3 p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/card:opacity-100 transition-opacity z-10"
                                    onClick={(e) => handleRemoveRecent(e, recent.id)}
                                    title="Remove from recent"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-app)] flex items-center justify-center text-[var(--color-text-muted)] mb-4">
                                    <File size={24} />
                                </div>
                                <h3 className="font-semibold text-[var(--color-text-main)] mb-1 truncate" title={recent.name}>{recent.name}</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mb-1">{recent.pageCount} pages</p>
                                <div className="flex justify-between items-center text-sm text-[var(--color-text-muted)] mt-auto pt-4 border-t border-[var(--color-border)]">
                                    <span>{formatDate(recent.lastOpened)}</span>
                                    <span>{formatSize(recent.size)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
