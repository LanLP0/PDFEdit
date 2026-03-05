import { useRef, useMemo } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCw, Trash2, FilePlus } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PagesPanelProps {
    activePageIndex: number;
    onPageSelect: (index: number) => void;
}

export function PagesPanel({ activePageIndex, onPageSelect }: PagesPanelProps) {
    const { document, rotatePage, deletePage, updatePageOrder } = usePDFStore();
    const mergeInputRef = useRef<HTMLInputElement>(null);
    const handleMergeFile = usePDFStore((state) => state.mergeFile);

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

            <div className='absolute bottom-0 py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all'>
                <button onClick={() => mergeInputRef.current?.click()} className='w-full py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all bg-(--color-bg-panel) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main)'>
                    <FilePlus size={18} />
                    Merge PDF
                </button>
                <input type="file" accept="application/pdf" className="hidden" ref={mergeInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMergeFile(f); if (mergeInputRef.current) mergeInputRef.current.value = ''; }} />
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
