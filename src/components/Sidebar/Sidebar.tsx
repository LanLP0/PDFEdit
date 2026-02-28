import { useEffect, useMemo, useRef, useState } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import type { ToolType } from '../../store/usePDFStore';
import { defaultTextStyle, availableFonts } from '../../store/usePDFStore';
import { MousePointer2, Type, Image as ImageIcon, PenTool, Layers, Grid2X2, Bold, Italic, Underline, Highlighter, Pencil, GripVertical, RotateCw, Trash2, Link2, Move, ChevronLeft, FilePlus } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

const tools: { id: ToolType; icon: typeof MousePointer2; label: string }[] = [
    { id: 'pointer', icon: MousePointer2, label: 'Select' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'link', icon: Link2, label: 'Add URL' },
    { id: 'image', icon: ImageIcon, label: 'Image' },
    { id: 'signature', icon: PenTool, label: 'Sign' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'draw', icon: Pencil, label: 'Draw' },
    { id: 'move', icon: Move, label: 'Move' },
];

const fontSizeOptions = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

interface SidebarProps {
    activePageIndex: number;
    onPageSelect: (index: number) => void;
}

export function Sidebar({ activePageIndex, onPageSelect }: SidebarProps) {
    const { settings, document, closeDocument, setSidebarMode, setActiveTool, setCurrentTextStyle, setBrushSettings, updateAnnotation, selectAnnotation, rotatePage, deletePage, updatePageOrder } = usePDFStore();
    const { sidebarMode, activeTool, currentTextStyle, brushSettings, selectedAnnotationId, selectedAnnotationPageId } = settings;

    const mergeInputRef = useRef<HTMLInputElement>(null);
    const handleMergeFile = usePDFStore((state) => state.mergeFile);

    const selectedAnn = selectedAnnotationId && selectedAnnotationPageId
        ? (document.modifications.annotations[selectedAnnotationPageId] || []).find(a => a.id === selectedAnnotationId)
        : null;
    const isEditingTextAnn = selectedAnn?.type === 'text';
    const editStyle = isEditingTextAnn && selectedAnn?.textStyle ? selectedAnn.textStyle : null;
    const activeStyle = editStyle || currentTextStyle;
    const showTextOptions = activeTool === 'text' || isEditingTextAnn;
    const showHighlightOptions = activeTool === 'highlight';
    const showDrawOptions = activeTool === 'draw';

    const sidebarCollapse = usePDFStore((state) => state.settings.sidebarCollapse);
    const setSidebarCollapse = usePDFStore((state) => state.setSidebarCollapse);
    const [isSmallWidth, setIsSmallWidth] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 1023px)');
        const handler = (e: MediaQueryListEvent | MediaQueryList) => {
            let isSmallWidth = Boolean(e.matches);
            setSidebarCollapse(isSmallWidth);
            setIsSmallWidth(isSmallWidth);
        };

        setSidebarCollapse(mq.matches);
        setIsSmallWidth(mq.matches);
        mq.addEventListener('change', handler);
        return () => {
            mq.removeEventListener('change', handler);
        };
    }, []);

    const handleGoHome = () => {
        if (!document.originalBytes) return;
        const hasModifications =
            Object.keys(document.modifications.rotations).length > 0 ||
            Object.keys(document.modifications.annotations).length > 0 ||
            document.modifications.deletedPages.length > 0;

        if (hasModifications) {
            const answer = window.confirm('You have unsaved changes. Do you want to discard them and go back to the home screen?');
            if (!answer) return;
        }
        closeDocument();
    };

    // Get current font definition for variant support checks
    const currentFontDef = availableFonts.find(f => f.name === activeStyle.fontFamily) || availableFonts[0];

    const handleStyleChange = (updates: Record<string, any>) => {
        if (isEditingTextAnn && selectedAnnotationPageId && selectedAnnotationId && selectedAnn) {
            updateAnnotation(selectedAnnotationPageId, selectedAnnotationId, { textStyle: { ...(selectedAnn.textStyle || defaultTextStyle), ...updates } });
        } else {
            setCurrentTextStyle(updates);
        }
    };

    // Get the active color for the current tool
    const getActiveToolColor = () => {
        if (showTextOptions) return activeStyle.color;
        if (showHighlightOptions) return brushSettings.highlightColor;
        if (showDrawOptions) return brushSettings.drawColor;
        return '#000000';
    };

    const handleToolColorChange = (color: string) => {
        if (showTextOptions) {
            handleStyleChange({ color });
        } else if (showHighlightOptions) {
            setBrushSettings({ highlightColor: color });
        } else if (showDrawOptions) {
            setBrushSettings({ drawColor: color });
        }
    };

    const showColorPicker = showTextOptions || showHighlightOptions || showDrawOptions;

    // Thumbnails
    const order = document.modifications.pageOrder;
    const fileUrl = useMemo(() => {
        if (!document.originalBytes) return null;
        const blob = new Blob([document.originalBytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    }, [document.originalBytes]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = order.indexOf(active.id as string);
            const newIndex = order.indexOf(over.id as string);
            if (oldIndex !== -1 && newIndex !== -1) updatePageOrder(arrayMove(order, oldIndex, newIndex));
        }
    };

    return (
        <div className={`${sidebarCollapse ? 'hidden' : 'w-52'} shrink-0 border-r border-(--color-border) bg-(--color-bg-panel) flex flex-col overflow-hidden`}>
            {/* Tab Headers */}
            <div className="flex items-center justify-center gap-2 px-3 py-3 shrink-0">
                <button
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all border ${sidebarMode === 'tools' ? 'border-primary text-primary bg-(--color-bg-active)' : 'border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover)'}`}
                    onClick={() => setSidebarMode('tools')}
                >
                    <Layers size={15} /> Tools
                </button>
                <button
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all border ${sidebarMode === 'thumbnails' ? 'border-primary text-primary bg-(--color-bg-active)' : 'border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover)'}`}
                    onClick={() => setSidebarMode('thumbnails')}
                >
                    <Grid2X2 size={15} /> Pages
                </button>
            </div>

            <div className="mx-3 h-px bg-(--color-border)"></div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {sidebarMode === 'tools' && (
                    <div className="py-3 space-y-3 mb-10">
                        {/* Per-tool Color Picker */}
                        {showColorPicker && (
                            <div className="mx-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted) block mb-1.5">Color</span>
                                <label className="flex items-center w-full h-9 rounded-lg border border-(--color-border) cursor-pointer overflow-hidden transition-all hover:border-primary relative">
                                    <div className="w-full h-full rounded-lg" style={{ backgroundColor: getActiveToolColor() }}></div>
                                    <input
                                        type="color"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        value={getActiveToolColor()}
                                        onChange={(e) => handleToolColorChange(e.target.value)}
                                    />
                                </label>
                            </div>
                        )}

                        {/* Text Options */}
                        {showTextOptions && (
                            <div className="mx-3">
                                <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">{isEditingTextAnn ? 'Edit Text' : 'Text Style'}</span>
                                    <select className="w-full px-2 py-1.5 rounded-lg border border-(--color-border) bg-(--color-bg-panel) text-(--color-text-main) text-xs outline-none focus:border-primary"
                                        value={activeStyle.fontFamily} onChange={(e) => handleStyleChange({ fontFamily: e.target.value })}>
                                        {availableFonts.map(f => <option key={f.name} value={f.name} style={{ fontFamily: f.webFamily }}>{f.name}</option>)}
                                    </select>
                                    <select className="w-full px-2 py-1.5 rounded-lg border border-(--color-border) bg-(--color-bg-panel) text-(--color-text-main) text-xs outline-none focus:border-primary"
                                        value={activeStyle.fontSize} onChange={(e) => handleStyleChange({ fontSize: Number(e.target.value) })}>
                                        {fontSizeOptions.map(s => <option key={s} value={s}>{s}px</option>)}
                                    </select>
                                    <div className="flex gap-1">
                                        <button
                                            className={`flex-1 p-1.5 rounded-lg transition-all flex items-center justify-center ${!currentFontDef.supportsBold ? 'opacity-30 cursor-not-allowed' : activeStyle.bold ? 'bg-primary text-white' : 'bg-(--color-bg-panel) text-(--color-text-muted) border border-(--color-border)'}`}
                                            onClick={() => { if (currentFontDef.supportsBold) handleStyleChange({ bold: !activeStyle.bold }); }}
                                            disabled={!currentFontDef.supportsBold}
                                            title={currentFontDef.supportsBold ? 'Bold' : 'Not supported for this font'}
                                        ><Bold size={14} /></button>
                                        <button
                                            className={`flex-1 p-1.5 rounded-lg transition-all flex items-center justify-center ${!currentFontDef.supportsItalic ? 'opacity-30 cursor-not-allowed' : activeStyle.italic ? 'bg-primary text-white' : 'bg-(--color-bg-panel) text-(--color-text-muted) border border-(--color-border)'}`}
                                            onClick={() => { if (currentFontDef.supportsItalic) handleStyleChange({ italic: !activeStyle.italic }); }}
                                            disabled={!currentFontDef.supportsItalic}
                                            title={currentFontDef.supportsItalic ? 'Italic' : 'Not supported for this font'}
                                        ><Italic size={14} /></button>
                                        <button className={`flex-1 p-1.5 rounded-lg transition-all flex items-center justify-center ${activeStyle.underline ? 'bg-primary text-white' : 'bg-(--color-bg-panel) text-(--color-text-muted) border border-(--color-border)'}`}
                                            onClick={() => handleStyleChange({ underline: !activeStyle.underline })}><Underline size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Highlight Options */}
                        {showHighlightOptions && (
                            <div className="mx-3">
                                <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">Highlight</span>
                                    <div>
                                        <span className="text-[10px] text-(--color-text-muted) block mb-1">Size: {brushSettings.highlightSize}px</span>
                                        <input type="range" min="8" max="100" value={brushSettings.highlightSize}
                                            onChange={(e) => setBrushSettings({ highlightSize: Number(e.target.value) })}
                                            className="w-full h-1.5 rounded-full appearance-none bg-(--color-border) accent-primary" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Draw Options */}
                        {showDrawOptions && (
                            <div className="mx-3">
                                <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">Draw</span>
                                    <div>
                                        <span className="text-[10px] text-(--color-text-muted) block mb-1">Size: {brushSettings.drawSize}px</span>
                                        <input type="range" min="1" max="50" value={brushSettings.drawSize}
                                            onChange={(e) => setBrushSettings({ drawSize: Number(e.target.value) })}
                                            className="w-full h-1.5 rounded-full appearance-none bg-(--color-border) accent-primary" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tool List */}
                        <div className="flex flex-col gap-1.5 px-3">
                            {tools.map((t) => {
                                const Icon = t.icon;
                                const isActive = activeTool === t.id;
                                return (
                                    <button key={t.id}
                                        className={`py-2.5 px-3 w-full rounded-lg flex items-center gap-3 text-sm font-medium transition-all border ${isActive ? 'border-primary text-primary bg-(--color-bg-active) shadow-sm' : 'border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main)'}`}
                                        onClick={() => { if (activeTool === t.id) return; setActiveTool(t.id); if (isSmallWidth) setSidebarCollapse(true); if (t.id !== 'text') selectAnnotation(null, null); }}
                                    >
                                        <Icon size={18} />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className='absolute bottom-0 py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all'>
                            <button onClick={handleGoHome} className='w-full py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all bg-(--color-bg-panel) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main)'>
                                <ChevronLeft size={18} />
                                Go back
                            </button>
                        </div>
                    </div>
                )}

                {sidebarMode === 'thumbnails' && (
                    <div className="p-2 space-y-2 mb-10">
                        <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
                            {order.length} Pages — Drag to reorder
                        </div>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={order} strategy={verticalListSortingStrategy}>
                                {order.map((pageId, index) => (
                                    <SortableThumbnail key={pageId} pageId={pageId} index={index}
                                        isActive={index === activePageIndex} fileUrl={fileUrl}
                                        rotation={document.modifications.rotations[pageId] || 0}
                                        onSelect={() => onPageSelect(index)}
                                        onRotate={() => rotatePage(pageId, 90)}
                                        onDelete={() => { if (order.length > 1) deletePage(pageId); }} />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {/* Merge PDF */}
                        <div className='absolute bottom-0 py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all'>
                            <button onClick={() => mergeInputRef.current?.click()} className='w-full py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all bg-(--color-bg-panel) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main)'>
                                <FilePlus size={18} />
                                Merge PDF
                            </button>
                            <input type="file" accept="application/pdf" className="hidden" ref={mergeInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMergeFile(f); if (mergeInputRef.current) mergeInputRef.current.value = ''; }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SortableThumbnail({ pageId, index, isActive, fileUrl, rotation, onSelect, onRotate, onDelete }: {
    pageId: string; index: number; isActive: boolean; fileUrl: string | null; rotation: number;
    onSelect: () => void; onRotate: () => void; onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pageId });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto' as const };
    const pageNumber = parseInt(pageId.split('-')[1], 10);

    return (
        <div ref={setNodeRef} style={style}
            className={`group rounded-lg border transition-all cursor-pointer mb-2 ${isActive ? 'border-primary shadow-md bg-(--color-bg-hover)' : 'border-(--color-border) hover:border-(--color-border-hover)'}`}
            onClick={onSelect}>
            <div className="flex items-center gap-1.5 p-1.5">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-(--color-text-muted) hover:text-(--color-text-main)">
                    <GripVertical size={12} />
                </div>
                <div className="flex-1 overflow-hidden rounded bg-white">
                    {fileUrl && (
                        <Document file={fileUrl} loading={<div className="w-full h-16 bg-gray-100 animate-pulse rounded" />}>
                            <Page pageNumber={pageNumber} width={140} rotate={rotation} renderTextLayer={false} renderAnnotationLayer={false} />
                        </Document>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-[10px] font-medium text-(--color-text-muted)">Page {index + 1}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-0.5 rounded text-(--color-text-muted) hover:text-(--color-text-main) hover:bg-(--color-bg-hover)"
                        onClick={(e) => { e.stopPropagation(); onRotate(); }} title="Rotate"><RotateCw size={11} /></button>
                    <button className="p-0.5 rounded text-(--color-text-muted) hover:text-red-500 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete"><Trash2 size={11} /></button>
                </div>
            </div>
        </div>
    );
}
