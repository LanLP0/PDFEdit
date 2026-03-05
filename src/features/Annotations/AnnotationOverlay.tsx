import { useRef, useState, useMemo } from "react";
import Modal from "react-modal";
import { usePDFStore } from "../../store/usePDFStore";
import type {
  Annotation,
  StrokePoint,
  LinkPayload,
} from "../../store/usePDFStore";
import { defaultTextStyle, availableFonts } from "../../store/usePDFStore";
import { Trash2, Link2 } from "lucide-react";

interface AnnotationOverlayProps {
  pageId: string;
  zoom: number;
}

// Calculate bounding box of stroke points (in percentage coordinates)
function getStrokeBBox(points: StrokePoint[], strokeWidth: number) {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  // Add padding for stroke width (convert from pt to percentage: strokeWidth/612*100)
  const pad = (strokeWidth / 612) * 100 * 0.6;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

export function AnnotationOverlay({ pageId, zoom }: AnnotationOverlayProps) {
  const { document, settings, addAnnotation, selectAnnotation } = usePDFStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const annotations: Annotation[] =
    document.modifications.annotations[pageId] || [];
  const activeTool = settings.activeTool;
  const selectedId =
    settings.selectedAnnotationPageId === pageId
      ? settings.selectedAnnotationId
      : null;

  // Scale factor: at 100% zoom the page is 612px matching 612pt PDF
  const scaleFactor = zoom / 100;

  // Stroke drawing state (for highlight/draw tools)
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);

  // Rectangle drawing state
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [rectStart, setRectStart] = useState<StrokePoint | null>(null);
  const [rectEnd, setRectEnd] = useState<StrokePoint | null>(null);

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkPos, setLinkPos] = useState({ x: 0, y: 0 });
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("https://");

  // Brush lock: when drawing tools are active, prevent annotation interaction
  const isBrushActive =
    activeTool === "highlight" ||
    activeTool === "draw" ||
    activeTool === "rectangle";

  const getRelativePos = (
    e: React.PointerEvent | React.MouseEvent,
  ): StrokePoint => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (
      e.target !== overlayRef.current &&
      e.target !== overlayRef.current?.querySelector(".stroke-svg")
    ) {
      return;
    }

    // Deselect on background click
    selectAnnotation(null, null);

    if (activeTool === "pointer" || activeTool === "move") return;

    const pos = getRelativePos(e);

    // Start drawing stroke for highlight/draw
    if (activeTool === "highlight" || activeTool === "draw") {
      setIsDrawing(true);
      setCurrentStroke([pos]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Start rectangle drag
    if (activeTool === "rectangle") {
      setIsDrawingRect(true);
      setRectStart(pos);
      setRectEnd(pos);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "text") {
      const id = crypto.randomUUID();
      const currentStyle = usePDFStore.getState().settings.currentTextStyle;
      addAnnotation(pageId, {
        id,
        type: "text",
        x: pos.x,
        y: pos.y,
        payload: "Double Click to Edit",
        textStyle: { ...currentStyle },
      });
      selectAnnotation(pageId, id);
      usePDFStore.getState().setActiveTool("pointer");
    }

    if (activeTool === "link") {
      setLinkPos(pos);
      setLinkText("");
      setLinkUrl("https://");
      setShowLinkDialog(true);
    }

    if (activeTool === "image") {
      const input = window.document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (evt) => {
        const file = (evt.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          if (typeof re.target?.result === "string") {
            const newId = crypto.randomUUID();
            addAnnotation(pageId, {
              id: newId,
              type: "image",
              x: pos.x,
              y: pos.y,
              width: 30,
              payload: re.target.result,
            });
            selectAnnotation(pageId, newId);
            usePDFStore.getState().setActiveTool("pointer");
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDrawingRect) {
      setRectEnd(getRelativePos(e));
      return;
    }
    if (!isDrawing) return;
    const pos = getRelativePos(e);
    setCurrentStroke((prev) => [...prev, pos]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // Finish rectangle drag
    if (isDrawingRect && rectStart && rectEnd) {
      setIsDrawingRect(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      const x = Math.min(rectStart.x, rectEnd.x);
      const y = Math.min(rectStart.y, rectEnd.y);
      const w = Math.abs(rectEnd.x - rectStart.x);
      const h = Math.abs(rectEnd.y - rectStart.y);

      if (w > 0.5 && h > 0.5) {
        const bs = usePDFStore.getState().settings.brushSettings;
        addAnnotation(pageId, {
          id: crypto.randomUUID(),
          type: "rectangle",
          x,
          y,
          payload: null,
          rectWidth: w,
          rectHeight: h,
          fillColor: bs.rectangleColor,
          outlineOnly: bs.rectangleOutlineOnly,
          borderWidth: bs.rectangleBorderWidth,
          strokeColor: bs.rectangleColor,
          rectOpacity: bs.rectangleOpacity,
        });
      }
      setRectStart(null);
      setRectEnd(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (currentStroke.length < 2) {
      setCurrentStroke([]);
      return;
    }

    const bs = usePDFStore.getState().settings.brushSettings;
    const type = activeTool as "highlight" | "draw";
    const isHighlight = type === "highlight";

    addAnnotation(pageId, {
      id: crypto.randomUUID(),
      type,
      x: 0,
      y: 0,
      payload: null,
      points: currentStroke,
      strokeColor: isHighlight ? bs.highlightColor : bs.drawColor,
      strokeWidth: isHighlight ? bs.highlightSize : bs.drawSize,
      strokeOpacity: isHighlight ? 0.35 : 1,
    });

    setCurrentStroke([]);
  };

  const handleInsertLink = () => {
    if (!linkText.trim() || !linkUrl.trim()) return;
    const id = crypto.randomUUID();
    const payload: LinkPayload = { text: linkText.trim(), url: linkUrl.trim() };
    addAnnotation(pageId, {
      id,
      type: "link",
      x: linkPos.x,
      y: linkPos.y,
      payload,
    });
    selectAnnotation(pageId, id);
    setShowLinkDialog(false);
    usePDFStore.getState().setActiveTool("pointer");
  };

  // Build SVG path from points
  const pointsToPath = (points: StrokePoint[]): string => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const bs = settings.brushSettings;
  const isHighlightActive = activeTool === "highlight";
  const currentColor = isHighlightActive ? bs.highlightColor : bs.drawColor;

  const cursorStyle = activeTool === "pointer" ? "default" : "crosshair";

  // Split annotations into strokes, rectangles, and others
  const strokeAnnotations = annotations.filter(
    (a) => a.type === "highlight" || a.type === "draw",
  );
  const rectAnnotations = annotations.filter((a) => a.type === "rectangle");
  const otherAnnotations = annotations.filter(
    (a) =>
      a.type !== "highlight" && a.type !== "draw" && a.type !== "rectangle",
  );

  // Rectangle preview during drag
  const rectPreview =
    isDrawingRect && rectStart && rectEnd
      ? {
          x: Math.min(rectStart.x, rectEnd.x),
          y: Math.min(rectStart.y, rectEnd.y),
          w: Math.abs(rectEnd.x - rectStart.x),
          h: Math.abs(rectEnd.y - rectStart.y),
        }
      : null;

  return (
    <div
      ref={overlayRef}
      className="absolute top-0 left-0 w-full h-full z-20 overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: cursorStyle }}
    >
      {/* Active stroke being drawn — uses a full-page SVG */}
      {currentStroke.length > 1 && (
        <svg
          className="stroke-svg absolute top-0 left-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={pointsToPath(currentStroke)}
            fill="none"
            stroke={currentColor}
            strokeWidth={
              ((isHighlightActive ? bs.highlightSize : bs.drawSize) / 612) * 100
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={isHighlightActive ? 0.35 : 1}
          />
        </svg>
      )}

      {/* Rectangle preview during drag */}
      {rectPreview && rectPreview.w > 0.2 && rectPreview.h > 0.2 && (
        <div
          className="absolute pointer-events-none border-2 border-dashed"
          style={{
            left: `${rectPreview.x}%`,
            top: `${rectPreview.y}%`,
            width: `${rectPreview.w}%`,
            height: `${rectPreview.h}%`,
            borderColor: bs.rectangleColor,
            backgroundColor: bs.rectangleOutlineOnly
              ? "transparent"
              : `${bs.rectangleColor}22`,
          }}
        />
      )}

      {/* Existing stroke annotations */}
      <div className={isBrushActive ? "pointer-events-none" : ""}>
        {strokeAnnotations.map((ann) => (
          <StrokeAnnotation
            key={ann.id}
            pageId={pageId}
            annotation={ann}
            containerRef={overlayRef}
            isSelected={!isBrushActive && selectedId === ann.id}
          />
        ))}
      </div>

      {/* Rectangle annotations */}
      <div className={isBrushActive ? "pointer-events-none" : ""}>
        {rectAnnotations.map((ann) => (
          <RectAnnotation
            key={ann.id}
            pageId={pageId}
            annotation={ann}
            containerRef={overlayRef}
            isSelected={!isBrushActive && selectedId === ann.id}
          />
        ))}
      </div>

      {/* Regular annotations (text, image, signature, link) */}
      <div className={isBrushActive ? "pointer-events-none" : ""}>
        {otherAnnotations.map((ann: Annotation) => (
          <DraggableAnnotation
            key={ann.id}
            pageId={pageId}
            annotation={ann}
            containerRef={overlayRef}
            isSelected={!isBrushActive && selectedId === ann.id}
            scaleFactor={scaleFactor}
          />
        ))}
      </div>

      {/* Link Dialog */}
      <Modal
        isOpen={showLinkDialog}
        onRequestClose={() => setShowLinkDialog(false)}
        contentLabel="Add URL Link"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-(--color-bg-panel) rounded-xl shadow-xl border border-(--color-border) p-5 w-80 outline-none"
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        closeTimeoutMS={200}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="text-primary" size={18} />
            <h3 className="text-sm font-semibold text-(--color-text-main)">
              Add URL Link
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted) block mb-1.5 ml-1">
                Display Text
              </label>
              <input
                type="text"
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-(--color-border) bg-(--color-bg-app) text-(--color-text-main) text-sm outline-none focus:border-primary transition-all"
                placeholder="Click here"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInsertLink();
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted) block mb-1.5 ml-1">
                URL
              </label>
              <input
                type="url"
                className="w-full px-3 py-2 rounded-lg border border-(--color-border) bg-(--color-bg-app) text-(--color-text-main) text-sm outline-none focus:border-primary transition-all"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInsertLink();
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg border border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover) transition-all"
              onClick={() => setShowLinkDialog(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
              onClick={handleInsertLink}
              disabled={!linkText.trim() || !linkUrl.trim()}
            >
              Insert
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// StrokeAnnotation: selectable, movable, deletable stroke rendered as a positioned SVG
function StrokeAnnotation({
  pageId,
  annotation,
  containerRef,
  isSelected,
}: {
  pageId: string;
  annotation: Annotation;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const updateAnnotation = usePDFStore((state) => state.updateAnnotation);
  const deleteAnnotation = usePDFStore((state) => state.deleteAnnotation);
  const selectAnnotation = usePDFStore((state) => state.selectAnnotation);

  const points = annotation.points || [];
  const sw = annotation.strokeWidth || 3;
  const bbox = useMemo(() => getStrokeBBox(points, sw), [points, sw]);

  // Map points into local SVG coordinates relative to the bounding box
  const localPath = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x - bbox.x} ${points[0].y - bbox.y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x - bbox.x} ${points[i].y - bbox.y}`;
    }
    return d;
  }, [points, bbox]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    selectAnnotation(pageId, annotation.id);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStart.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    setIsDragging(true);
    usePDFStore.getState().suspendRecordingUndo();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current || !dragStart.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = ((e.clientX - rect.left) / rect.width) * 100;
    const curY = ((e.clientY - rect.top) / rect.height) * 100;
    const dx = curX - dragStart.current.x;
    const dy = curY - dragStart.current.y;
    dragStart.current = { x: curX, y: curY };

    // Offset all points
    const newPoints = points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    updateAnnotation(pageId, annotation.id, { points: newPoints });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    usePDFStore.getState().resumeRecordingUndo();
    dragStart.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAnnotation(pageId, annotation.id);
  };

  if (bbox.w <= 0 && bbox.h <= 0) return null;

  return (
    <div
      className={`absolute cursor-move ${isSelected ? "ring-2 ring-primary ring-offset-1 rounded" : ""}`}
      style={{
        left: `${bbox.x}%`,
        top: `${bbox.y}%`,
        width: `${bbox.w}%`,
        height: `${bbox.h}%`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg
        className="absolute top-0 left-0 w-full h-full"
        viewBox={`0 0 ${bbox.w} ${bbox.h}`}
        preserveAspectRatio="none"
      >
        <path
          d={localPath}
          fill="none"
          stroke={annotation.strokeColor || "#000"}
          strokeWidth={(sw / 612) * 100}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={annotation.strokeOpacity ?? 1}
        />
      </svg>
      {isSelected && (
        <div className="absolute -top-5 -right-5 z-30">
          <button
            className="w-8 h-8 rounded-lg bg-(--color-bg-panel) border border-(--color-border) shadow-(--shadow-floating) flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            onPointerDown={handleDelete}
            title="Delete annotation"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function DraggableAnnotation({
  pageId,
  annotation,
  containerRef,
  isSelected,
  scaleFactor,
}: {
  pageId: string;
  annotation: Annotation;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  scaleFactor: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const activeTool = usePDFStore((state) => state.settings.activeTool);
  const updateAnnotation = usePDFStore((state) => state.updateAnnotation);
  const deleteAnnotation = usePDFStore((state) => state.deleteAnnotation);
  const selectAnnotation = usePDFStore((state) => state.selectAnnotation);
  const setActiveTool = usePDFStore((state) => state.setActiveTool);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    selectAnnotation(pageId, annotation.id);
    if (annotation.type === "text" && activeTool !== "move")
      setActiveTool("text");
    setIsDragging(true);
    usePDFStore.getState().suspendRecordingUndo();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    const yPct = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
    );
    updateAnnotation(pageId, annotation.id, { x: xPct, y: yPct });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    usePDFStore.getState().resumeRecordingUndo();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (annotation.type === "text") {
      setIsEditing(true);
    }
    if (annotation.type === "link") {
      const payload = annotation.payload as LinkPayload;
      if (payload.url) window.open(payload.url, "_blank");
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAnnotation(pageId, annotation.id);
  };

  const textStyle = annotation.textStyle || defaultTextStyle;
  const fontDef =
    availableFonts.find((f) => f.name === textStyle.fontFamily) ||
    availableFonts[0];
  const scaledFontSize = textStyle.fontSize * scaleFactor;
  const textCss: React.CSSProperties = {
    fontFamily: fontDef.webFamily,
    fontSize: `${scaledFontSize}px`,
    fontWeight: textStyle.bold ? "bold" : "normal",
    fontStyle: textStyle.italic ? "italic" : "normal",
    textDecoration: textStyle.underline ? "underline" : "none",
    color: textStyle.color || "#000000",
  };

  const scaledLinkFontSize = 14 * scaleFactor;

  return (
    <div
      className={`absolute outline-none rounded-sm cursor-move ${isDragging ? "opacity-80" : ""} ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
      style={{
        left: `${annotation.x}%`,
        top: `${annotation.y}%`,
        width: annotation.width ? `${annotation.width}%` : "auto",
        transform: "translate(-50%, -50%)",
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
            className="w-8 h-8 rounded-lg bg-(--color-bg-panel) border border-(--color-border) shadow-(--shadow-floating) flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            onClick={handleDelete}
            title="Delete annotation"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {annotation.type === "text" &&
        (isEditing ? (
          <input
            autoFocus
            className="bg-transparent border-b border-primary outline-none w-min min-w-[100px]"
            style={textCss}
            value={annotation.payload}
            onChange={(e) =>
              updateAnnotation(pageId, annotation.id, {
                payload: e.target.value,
              })
            }
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") setIsEditing(false);
            }}
          />
        ) : (
          <div
            className="whitespace-nowrap drop-shadow-sm select-none pointer-events-none"
            style={textCss}
          >
            {annotation.payload}
          </div>
        ))}

      {annotation.type === "link" && (
        <div
          className="whitespace-nowrap select-none pointer-events-none flex items-center gap-1"
          style={{ fontSize: `${scaledLinkFontSize}px` }}
        >
          <span className="text-blue-600 underline cursor-pointer">
            {(annotation.payload as LinkPayload).text}
          </span>
        </div>
      )}

      {(annotation.type === "image" || annotation.type === "signature") && (
        <img
          src={annotation.payload}
          alt="Annotation"
          className="w-full h-auto rounded-md shadow-sm border border-(--color-border-hover) select-none pointer-events-none bg-white"
          draggable={false}
        />
      )}
    </div>
  );
}

// RectAnnotation: selectable, movable, deletable rectangle
function RectAnnotation({
  pageId,
  annotation,
  containerRef,
  isSelected,
}: {
  pageId: string;
  annotation: Annotation;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const updateAnnotation = usePDFStore((state) => state.updateAnnotation);
  const deleteAnnotation = usePDFStore((state) => state.deleteAnnotation);
  const selectAnnotation = usePDFStore((state) => state.selectAnnotation);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    selectAnnotation(pageId, annotation.id);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStart.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100 - annotation.x,
      y: ((e.clientY - rect.top) / rect.height) * 100 - annotation.y,
    };
    setIsDragging(true);
    usePDFStore.getState().suspendRecordingUndo();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current || !dragStart.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct =
      ((e.clientX - rect.left) / rect.width) * 100 - dragStart.current.x;
    const yPct =
      ((e.clientY - rect.top) / rect.height) * 100 - dragStart.current.y;
    updateAnnotation(pageId, annotation.id, { x: xPct, y: yPct });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragStart.current = null;
    usePDFStore.getState().resumeRecordingUndo();
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAnnotation(pageId, annotation.id);
  };

  const color = annotation.fillColor || annotation.strokeColor || "#3B82F6";
  const outlineOnly = annotation.outlineOnly ?? false;
  const borderW = annotation.borderWidth ?? 2;
  const opacity = annotation.rectOpacity ?? 0.6;

  return (
    <div
      className={`absolute cursor-move ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
      style={{
        left: `${annotation.x}%`,
        top: `${annotation.y}%`,
        width: `${annotation.rectWidth || 10}%`,
        height: `${annotation.rectHeight || 10}%`,
        border: outlineOnly ? `${borderW}px solid ${color}` : "none",
        borderRadius: outlineOnly ? "2px" : "0",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {!outlineOnly && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundColor: color,
            opacity: opacity,
          }}
        />
      )}

      {isSelected && (
        <div className="absolute -top-5 -right-5 z-30 opacity-100">
          <button
            className="w-8 h-8 rounded-lg bg-(--color-bg-panel) border border-(--color-border) shadow-(--shadow-floating) flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            onPointerDown={handleDelete}
            title="Delete annotation"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
