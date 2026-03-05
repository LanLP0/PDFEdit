import { useState } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import type { Bookmark, OutlineItem } from '../../store/usePDFStore';
import { BookmarkPlus, Trash2, Pencil, Check, X, ChevronRight, ChevronDown, FileText, BookMarked } from 'lucide-react';

interface BookmarksPanelProps {
    activePageIndex: number;
    onPageSelect: (index: number) => void;
}

export function BookmarksPanel({ activePageIndex, onPageSelect }: BookmarksPanelProps) {
    const { document, addBookmark, removeBookmark, updateBookmark } = usePDFStore();
    const { bookmarks, outline } = document;
    const order = document.modifications.pageOrder;

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const handleAdd = () => {
        const currentPageId = order[activePageIndex];
        if (!currentPageId) return;
        const id = `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const pageNum = activePageIndex + 1;
        addBookmark({ id, title: `Bookmark — Page ${pageNum}`, pageId: currentPageId });
    };

    const handleNavigate = (pageId: string) => {
        const idx = order.indexOf(pageId);
        if (idx >= 0) onPageSelect(idx);
    };

    const startEdit = (bookmark: Bookmark) => {
        setEditingId(bookmark.id);
        setEditTitle(bookmark.title);
    };

    const confirmEdit = () => {
        if (editingId && editTitle.trim()) {
            updateBookmark(editingId, { title: editTitle.trim() });
        }
        setEditingId(null);
    };

    const cancelEdit = () => setEditingId(null);

    const hasContent = outline.length > 0 || bookmarks.length > 0;

    return (
        <div className="p-2 space-y-1 mb-10">
            {/* Header with add button */}
            <div className="px-1 py-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
                    Bookmarks
                </span>
                <button
                    onClick={handleAdd}
                    className="p-1.5 rounded-lg text-(--color-text-muted) hover:text-primary hover:bg-(--color-bg-hover) transition-all"
                    title="Bookmark current page"
                >
                    <BookmarkPlus size={16} />
                </button>
            </div>

            {!hasContent ? (
                <div className="text-center py-8 px-3 text-(--color-text-muted)">
                    <BookMarked size={28} className="mx-auto mb-3 opacity-30" />
                    <p className="text-xs">No bookmarks yet.</p>
                    <p className="text-xs mt-1">Click <strong>+</strong> to bookmark the current page.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-0.5">
                    {/* User Bookmarks */}
                    {bookmarks.length > 0 && (
                        <>
                            {bookmarks.map((bm) => {
                                const pageIdx = order.indexOf(bm.pageId);
                                const pageLabel = pageIdx >= 0 ? `Page ${pageIdx + 1}` : 'Unknown';
                                const isActive = pageIdx === activePageIndex;
                                const isEditing = editingId === bm.id;

                                return (
                                    <div
                                        key={bm.id}
                                        className={`group rounded-lg p-2 transition-all cursor-pointer ${isActive ? 'bg-(--color-bg-active) text-primary' : 'text-(--color-text-main) hover:bg-(--color-bg-hover)'}`}
                                        onClick={() => !isEditing && handleNavigate(bm.pageId)}
                                    >
                                        {isEditing ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    className="flex-1 px-1.5 py-0.5 text-xs rounded border border-(--color-border) bg-(--color-bg-panel) text-(--color-text-main) outline-none focus:border-primary"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <button onClick={(e) => { e.stopPropagation(); confirmEdit(); }} className="p-0.5 rounded text-green-500 hover:bg-green-50"><Check size={12} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="p-0.5 rounded text-(--color-text-muted) hover:bg-(--color-bg-hover)"><X size={12} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <FileText size={12} className="shrink-0 text-(--color-text-muted)" />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-medium truncate">{bm.title}</div>
                                                        <div className="text-[10px] text-(--color-text-muted)">{pageLabel}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                                                    <button onClick={(e) => { e.stopPropagation(); startEdit(bm); }} className="p-0.5 rounded text-(--color-text-muted) hover:text-primary hover:bg-(--color-bg-hover)" title="Rename"><Pencil size={11} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id); }} className="p-0.5 rounded text-(--color-text-muted) hover:text-red-500 hover:bg-red-50" title="Delete"><Trash2 size={11} /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* PDF Outline (Sections) */}
                    {outline.length > 0 && (
                        <>
                            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
                                Table of Contents
                            </div>
                            {outline.map((item, i) => (
                                <OutlineNode key={`outline-${i}`} item={item} depth={0} order={order} activePageIndex={activePageIndex} onNavigate={handleNavigate} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/** Expandable outline tree node */
function OutlineNode({ item, depth, order, activePageIndex, onNavigate }: {
    item: OutlineItem;
    depth: number;
    order: string[];
    activePageIndex: number;
    onNavigate: (pageId: string) => void;
}) {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = item.children.length > 0;
    const pageIdx = order.indexOf(item.pageId);
    const isActive = pageIdx === activePageIndex;

    return (
        <div>
            <div
                className={`flex items-center gap-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${isActive ? 'bg-(--color-bg-active) text-primary' : 'text-(--color-text-main) hover:bg-(--color-bg-hover)'}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => onNavigate(item.pageId)}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        className="p-0.5 rounded text-(--color-text-muted) hover:text-(--color-text-main) shrink-0"
                    >
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                ) : (
                    <span className="w-[16px] shrink-0" />
                )}
                <span className="text-xs truncate flex-1" title={item.title}>{item.title}</span>
                {pageIdx >= 0 && (
                    <span className="text-[10px] text-(--color-text-muted) shrink-0 ml-1">{pageIdx + 1}</span>
                )}
            </div>
            {hasChildren && expanded && (
                <div>
                    {item.children.map((child, i) => (
                        <OutlineNode key={i} item={child} depth={depth + 1} order={order} activePageIndex={activePageIndex} onNavigate={onNavigate} />
                    ))}
                </div>
            )}
        </div>
    );
}
