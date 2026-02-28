import { useMemo } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCw, Trash2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface ThumbnailSidebarProps {
    activePageIndex: number;
    onPageSelect: (index: number) => void;
}

export function ThumbnailSidebar({ activePageIndex, onPageSelect }: ThumbnailSidebarProps) {
    const { document, updatePageOrder, rotatePage, deletePage } = usePDFStore();
    const order = document.modifications.pageOrder;

    // Memoize the file URL so react-pdf Document doesn't re-mount on every render
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
            if (oldIndex !== -1 && newIndex !== -1) {
                updatePageOrder(arrayMove(order, oldIndex, newIndex));
            }
        }
    };

    return (
        <div className="w-56 border-r border-(--color-border) bg-(--color-bg-panel) flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-3 border-b border-(--color-border) text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                Pages ({order.length})
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={order} strategy={verticalListSortingStrategy}>
                        {order.map((pageId, index) => (
                            <SortableThumbnail
                                key={pageId}
                                pageId={pageId}
                                index={index}
                                isActive={index === activePageIndex}
                                fileUrl={fileUrl}
                                rotation={document.modifications.rotations[pageId] || 0}
                                onSelect={() => onPageSelect(index)}
                                onRotate={() => rotatePage(pageId, 90)}
                                onDelete={() => {
                                    if (order.length <= 1) return;
                                    deletePage(pageId);
                                }}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}

interface SortableThumbnailProps {
    pageId: string;
    index: number;
    isActive: boolean;
    fileUrl: string | null;
    rotation: number;
    onSelect: () => void;
    onRotate: () => void;
    onDelete: () => void;
}

function SortableThumbnail({ pageId, index, isActive, fileUrl, rotation, onSelect, onRotate, onDelete }: SortableThumbnailProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: pageId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 'auto' as const,
    };

    const pageNumber = parseInt(pageId.split('-')[1], 10);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group rounded-lg border transition-all cursor-pointer ${isActive ? 'border-primary shadow-md bg-(--color-bg-hover)' : 'border-(--color-border) hover:border-(--color-border-hover)'}`}
            onClick={onSelect}
        >
            <div className="flex items-center gap-2 p-1.5">
                {/* Drag handle */}
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-(--color-text-muted) hover:text-(--color-text-main)">
                    <GripVertical size={14} />
                </div>

                {/* Thumbnail preview */}
                <div className="flex-1 overflow-hidden rounded bg-white">
                    {fileUrl && (
                        <Document file={fileUrl} loading={<div className="w-full h-20 bg-gray-100 animate-pulse rounded" />}>
                            <Page
                                pageNumber={pageNumber}
                                width={120}
                                rotate={rotation}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                            />
                        </Document>
                    )}
                </div>
            </div>

            {/* Bottom bar with page number and actions */}
            <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-xs font-medium text-(--color-text-muted)">
                    Page {index + 1}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="p-1 rounded text-(--color-text-muted) hover:text-(--color-text-main) hover:bg-(--color-bg-hover)"
                        onClick={(e) => { e.stopPropagation(); onRotate(); }}
                        title="Rotate"
                    >
                        <RotateCw size={12} />
                    </button>
                    <button
                        className="p-1 rounded text-(--color-text-muted) hover:text-red-500 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        title="Delete"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
