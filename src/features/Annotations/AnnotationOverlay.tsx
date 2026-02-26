import React, { useRef, useState } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import type { Annotation, StrokePoint } from '../../store/usePDFStore';
import { defaultTextStyle } from '../../store/usePDFStore';
import { Trash2 } from 'lucide-react';

interface AnnotationOverlayProps {
    pageId: string;
}

export function AnnotationOverlay({ pageId }: AnnotationOverlayProps) {
    const { document, settings, addAnnotation, selectAnnotation } = usePDFStore();
    const overlayRef = useRef<HTMLDivElement>(null);
    const annotations: Annotation[] = document.modifications.annotations[pageId] || [];
    const activeTool = settings.activeTool;
    const selectedId = settings.selectedAnnotationPageId === pageId ? settings.selectedAnnotationId : null;

    // Stroke drawing state (for highlight/draw tools)
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);

    const getRelativePos = (e: React.PointerEvent): StrokePoint => {
        const rect = overlayRef.current!.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.target !== overlayRef.current && e.target !== (overlayRef.current?.querySelector('.stroke-svg'))) {
            return;
        }

        // Deselect on background click
        selectAnnotation(null, null);

        if (activeTool === 'pointer') return;

        const pos = getRelativePos(e);

        // Start drawing stroke for highlight/draw
        if (activeTool === 'highlight' || activeTool === 'draw') {
            setIsDrawing(true);
            setCurrentStroke([pos]);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
        }

        if (activeTool === 'text') {
            const id = crypto.randomUUID();
            const currentStyle = usePDFStore.getState().settings.currentTextStyle;
            addAnnotation(pageId, {
                id, type: 'text', x: pos.x, y: pos.y,
                payload: 'Double Click to Edit',
                textStyle: { ...currentStyle },
            });
            selectAnnotation(pageId, id);
            usePDFStore.getState().setActiveTool('pointer');
        }

        if (activeTool === 'image') {
            const input = window.document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (evt) => {
                const file = (evt.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (re) => {
                    if (typeof re.target?.result === 'string') {
                        const newId = crypto.randomUUID();
                        addAnnotation(pageId, {
                            id: newId, type: 'image', x: pos.x, y: pos.y,
                            width: 30, payload: re.target.result
                        });
                        selectAnnotation(pageId, newId);
                        usePDFStore.getState().setActiveTool('pointer');
                    }
                };
                reader.readAsDataURL(file);
            };
            input.click();
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        const pos = getRelativePos(e);
        setCurrentStroke(prev => [...prev, pos]);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        setIsDrawing(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        if (currentStroke.length < 2) {
            setCurrentStroke([]);
            return;
        }

        const bs = usePDFStore.getState().settings.brushSettings;
        const ac = usePDFStore.getState().settings.activeColor;
        const type = activeTool as 'highlight' | 'draw';
        const isHighlight = type === 'highlight';

        addAnnotation(pageId, {
            id: crypto.randomUUID(),
            type,
            x: 0, y: 0,
            payload: null,
            points: currentStroke,
            strokeColor: ac,
            strokeWidth: isHighlight ? bs.highlightSize : bs.drawSize,
            strokeOpacity: isHighlight ? 0.35 : 1,
        });

        setCurrentStroke([]);
    };

    // Build SVG path from points
    const pointsToPath = (points: StrokePoint[]): string => {
        if (points.length === 0) return '';
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        return d;
    };

    const bs = settings.brushSettings;
    const isHighlightActive = activeTool === 'highlight';
    const currentColor = settings.activeColor;

    // Generate custom cursor for drawing tools
    let cursorStyle = 'default';
    if (activeTool !== 'pointer') {
        if (activeTool === 'highlight' || activeTool === 'draw') {
            const size = activeTool === 'highlight' ? bs.highlightSize : bs.drawSize;
            const opacity = activeTool === 'highlight' ? 0.35 : 1;
            const sizeStr = Math.max(8, size); // ensure minimum size for svg
            const color = currentColor || '#000000';

            // Create an SVG circle representing the brush
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeStr}" height="${sizeStr}" viewBox="0 0 ${sizeStr} ${sizeStr}">
                <circle cx="${sizeStr / 2}" cy="${sizeStr / 2}" r="${sizeStr / 2 - 0.5}" fill="${color}" fill-opacity="${opacity}" stroke="#000000" stroke-opacity="0.5" stroke-width="1"/>
            </svg>`;

            const encodedSvg = encodeURIComponent(svg.trim()).replace(/'/g, '%27').replace(/"/g, '%22');
            cursorStyle = `url("data:image/svg+xml;charset=utf-8,${encodedSvg}") ${sizeStr / 2} ${sizeStr / 2}, crosshair`;
        } else {
            cursorStyle = 'crosshair';
        }
    }

    return (
        <div
            ref={overlayRef}
            className="absolute top-0 left-0 w-full h-full z-20 overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ cursor: cursorStyle }}
        >
            {/* SVG layer for strokes */}
            <svg className="stroke-svg absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Existing stroke annotations */}
                {annotations.filter(a => a.type === 'highlight' || a.type === 'draw').map(ann => (
                    <path
                        key={ann.id}
                        d={pointsToPath(ann.points || [])}
                        fill="none"
                        stroke={ann.strokeColor || '#000'}
                        strokeWidth={((ann.strokeWidth || 3) / 612) * 100} // convert px to viewBox units
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={ann.strokeOpacity ?? 1}
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: 'none' }}
                    />
                ))}
                {/* Active stroke being drawn */}
                {currentStroke.length > 1 && (
                    <path
                        d={pointsToPath(currentStroke)}
                        fill="none"
                        stroke={currentColor}
                        strokeWidth={((isHighlightActive ? bs.highlightSize : bs.drawSize) / 612) * 100}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={isHighlightActive ? 0.35 : 1}
                        vectorEffect="non-scaling-stroke"
                    />
                )}
            </svg>

            {/* Regular annotations (text, image, signature) */}
            {annotations.filter(a => a.type !== 'highlight' && a.type !== 'draw').map((ann: Annotation) => (
                <DraggableAnnotation
                    key={ann.id}
                    pageId={pageId}
                    annotation={ann}
                    containerRef={overlayRef}
                    isSelected={selectedId === ann.id}
                />
            ))}
        </div>
    );
}

function DraggableAnnotation({ pageId, annotation, containerRef, isSelected }: {
    pageId: string;
    annotation: Annotation;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isSelected: boolean;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const updateAnnotation = usePDFStore((state) => state.updateAnnotation);
    const deleteAnnotation = usePDFStore((state) => state.deleteAnnotation);
    const selectAnnotation = usePDFStore((state) => state.selectAnnotation);
    const setActiveTool = usePDFStore((state) => state.setActiveTool);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        selectAnnotation(pageId, annotation.id);
        if (annotation.type === 'text') setActiveTool('text');
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        updateAnnotation(pageId, annotation.id, { x: xPct, y: yPct });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (annotation.type === 'text') setIsEditing(true);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteAnnotation(pageId, annotation.id);
    };

    const textStyle = annotation.textStyle || defaultTextStyle;
    const textCss: React.CSSProperties = {
        fontFamily: textStyle.fontFamily,
        fontSize: `${textStyle.fontSize}px`,
        fontWeight: textStyle.bold ? 'bold' : 'normal',
        fontStyle: textStyle.italic ? 'italic' : 'normal',
        textDecoration: textStyle.underline ? 'underline' : 'none',
        color: textStyle.color || '#000000',
    };

    return (
        <div
            className={`absolute outline-none rounded-sm cursor-move ${isDragging ? 'opacity-80' : ''} ${isSelected ? 'ring-2 ring-[var(--color-primary)] ring-offset-1' : ''}`}
            style={{
                left: `${annotation.x}%`,
                top: `${annotation.y}%`,
                width: annotation.width ? `${annotation.width}%` : 'auto',
                transform: 'translate(-50%, -50%)',
            }}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
        >
            {isSelected && (
                <div className="absolute -top-5 -right-5 z-30">
                    <button
                        className="w-8 h-8 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-md flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        onClick={handleDelete}
                        title="Delete annotation"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}

            {annotation.type === 'text' && (
                isEditing ? (
                    <input
                        autoFocus
                        className="bg-transparent border-b border-[var(--color-primary)] outline-none w-min min-w-[100px]"
                        style={textCss}
                        value={annotation.payload}
                        onChange={(e) => updateAnnotation(pageId, annotation.id, { payload: e.target.value })}
                        onBlur={() => setIsEditing(false)}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') setIsEditing(false); }}
                    />
                ) : (
                    <div className="whitespace-nowrap drop-shadow-sm select-none pointer-events-none" style={textCss}>
                        {annotation.payload}
                    </div>
                )
            )}

            {(annotation.type === 'image' || annotation.type === 'signature') && (
                <img src={annotation.payload} alt="Annotation"
                    className="w-full h-auto rounded-md shadow-sm border border-[var(--color-border-hover)] select-none pointer-events-none bg-white"
                    draggable={false} />
            )}
        </div>
    );
}
