import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileText, Clock, File, Trash2, ALargeSmall, ArrowUpNarrowWide, ArrowDownNarrowWide, Github, Star } from 'lucide-react';
import { getRecentFiles, onRecentFilesUpdated, removeRecentFile } from '../../lib/recentFiles';
import type { RecentFileEntry } from '../../lib/recentFiles';
import { openFile, openFilePath, applyLoadedPdf } from '../../lib/openFile';
import { isElectron } from '../../lib/electron';

export function HomeScreen() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
    const [sortType, setSortType] = useState<'name' | 'date'>('date');
    const [sortAscending, setSortAscending] = useState<boolean>(false);

    useEffect(() => {
        (async () => {
            try {
                const files = await getRecentFiles();
                setRecentFiles(files);
                return onRecentFilesUpdated((f) => setRecentFiles(f));
            } catch (e) {
                console.error('Failed to load recent files', e);
            }
        })();
    }, []);

    // Ordering
    useEffect(() => {
        let sortedList = [...recentFiles].sort((a, b) => {
            if (sortType === 'name') {
                return sortAscending ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
            }
            return sortAscending ? a.lastOpened - b.lastOpened : b.lastOpened - a.lastOpened;
        });
        setRecentFiles(sortedList);
    }, [sortType, sortAscending]);

    const handleFileSelect = async (file: File) => {
        try {
            const pdf = await openFile(file);
            if (pdf) {
                await applyLoadedPdf(pdf);
            }
        } catch (err: any) {
            console.error('Failed to open file', err);
        }
    };

    const handleRecentClick = async (recent: RecentFileEntry) => {
        if (recent.locationType === 'FileSystem' && recent.location) {
            try {
                const pdf = await openFilePath(recent.location);
                if (pdf) await applyLoadedPdf(pdf);
            } catch (err) {
                console.error('Failed to reopen file', err);
            }
        } else {
            // Web files can't be reopened — prompt a file picker
            fileInputRef.current?.click();
        }
    };

    const handleRemoveRecent = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await removeRecentFile(id);
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
        <div className="flex-1 w-full h-full flex flex-col items-center bg-(--color-bg-app) overflow-y-auto px-6 py-12">
            {/* Main Floating Card Dropzone */}
            <div
                className={`max-w-4xl w-full p-10 flex flex-col md:flex-row items-center justify-between rounded-2xl bg-(--color-bg-panel) shadow-(--shadow-floating) transition-all cursor-pointer group mb-12 border-2 border-dashed ${isDragging ? 'border-primary bg-(--color-bg-hover)' : 'border-transparent'}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="flex-1 mb-8 md:mb-0 text-center md:text-left">
                    <h1 className="text-4xl font-bold mb-4 text-(--color-text-main) tracking-tight">PDFEdit</h1>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <button className="btn-primary inline-flex" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                            <FileText size={20} />
                            Select a PDF
                        </button>
                    </div>
                </div>
                <div className="w-64 h-64 rounded-xl border-2 border-dashed border-(--color-border) flex flex-col items-center justify-center bg-(--color-bg-app) group-hover:border-primary transition-all">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${isDragging ? 'bg-primary text-white scale-110' : 'bg-(--color-bg-panel) text-primary shadow-sm'}`}>
                        <UploadCloud size={40} />
                    </div>
                    <span className="font-semibold text-(--color-text-main)">Drop PDF Here</span>
                    <span className="text-sm text-(--color-text-muted) mt-1">or click to browse</span>
                </div>
                <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {/* Recent Files Grid */}
            <div className="max-w-4xl w-full">
                <div className="flex items-center gap-2 mb-6 text-(--color-text-main)">
                    <Clock size={20} className="text-primary" />
                    <h2 className="text-xl font-semibold">Recent Documents</h2>
                    <div className="flex-1"></div>
                    <div className="flex items-center gap-2 bg-(--color-bg-panel) rounded-md py-1 px-2 border border-(--color-border)">
                        <button onClick={() => { setSortType(sortType === 'name' ? 'date' : 'name'); }} className="p-1 rounded-md hover:text-primary hover:bg-(--color-bg-hover) transition-all">
                            {
                                sortType === 'name'
                                    ? <div className="inline-flex items-center gap-1"><ALargeSmall size={20} />&nbsp;Name</div>
                                    : <div className="inline-flex items-center gap-1"><Clock size={20} />&nbsp;Time</div>
                            }
                        </button>
                        <button onClick={() => { setSortAscending(!sortAscending); }} className="p-1 rounded-md hover:text-primary hover:bg-(--color-bg-hover) transition-all">
                            {
                                sortAscending
                                    ? <div className="inline-flex items-center gap-1"><ArrowUpNarrowWide size={20} />&nbsp;{sortType === 'name' ? 'Z-A' : 'Oldest'}</div>
                                    : <div className="inline-flex items-center gap-1"><ArrowDownNarrowWide size={20} />&nbsp;{sortType === 'name' ? 'A-Z' : 'Newest'}</div>
                            }
                        </button>
                    </div>
                </div>

                {recentFiles.length === 0 ? (
                    <div className="text-center py-12 text-(--color-text-muted)">
                        <File size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">No recent documents</p>
                        <p className="text-sm mt-1">Open a PDF to start. Your recent files will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {recentFiles.map((recent) => (
                            <div
                                key={recent.id}
                                className="bg-(--color-bg-panel) rounded-xl p-5 border border-(--color-border) shadow-sm hover:shadow-md hover:border-primary transition-all cursor-pointer flex flex-col group/card relative"
                                onClick={() => handleRecentClick(recent)}
                                title={recent.locationType === 'FileSystem' ? `Click to re-open ${recent.name}` : 'File not available — click to browse for a file'}
                            >
                                {/* Delete button: top-right corner */}
                                <button
                                    className="absolute top-3 right-3 p-1.5 rounded-md text-(--color-text-muted) hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/card:opacity-100 transition-opacity z-10"
                                    onClick={(e) => handleRemoveRecent(e, recent.id)}
                                    title="Remove from recent"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="w-12 h-12 rounded-lg bg-(--color-bg-app) flex items-center justify-center text-(--color-text-muted) mb-4">
                                    <File size={24} />
                                </div>
                                <h3 className="font-semibold text-(--color-text-main) mb-1 truncate" title={recent.name}>{recent.name}</h3>
                                <p className="text-xs text-(--color-text-muted) mb-1">
                                    {recent.pageCount} pages
                                    {isElectron && recent.locationType === 'Web' && <span className="ml-2 italic text-amber-500">• File not available</span>}
                                </p>
                                <div className="flex justify-between items-center text-sm text-(--color-text-muted) mt-auto pt-4 border-t border-(--color-border)">
                                    <span>{formatDate(recent.lastOpened)}</span>
                                    <span>{formatSize(recent.size)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <a
                href="https://github.com/LanLP0/PDFEdit"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:flex fixed bottom-6 right-6 items-center gap-2 px-4 py-2.5 rounded-xl bg-(--color-bg-panel) border border-(--color-border) shadow-sm hover:shadow-md hover:border-yellow-300 text-(--color-text-muted) hover:text-yellow-300 transition-all z-50"
            >
                <span className="text-sm font-medium">Give a</span>
                <Star size={16} className='text-yellow-300' />
                <span className="text-sm font-medium">on GitHub</span>
                <Github size={18} />
            </a>
        </div>
    );
}
