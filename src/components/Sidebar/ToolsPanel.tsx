import { useState } from "react";
import { defaultRectangleStyle, usePDFStore } from "../../store/usePDFStore";
import type { ToolType } from "../../store/usePDFStore";
import { defaultTextStyle, availableFonts } from "../../store/usePDFStore";
import {
  MousePointer2,
  Type,
  Image as ImageIcon,
  PenTool,
  Link2,
  Highlighter,
  Pencil,
  Move,
  Bold,
  Italic,
  Underline,
  ChevronLeft,
  Square,
} from "lucide-react";
import { ConfirmationModal } from "../Modal/ConfirmationModal";

const tools: { id: ToolType; icon: typeof MousePointer2; label: string }[] = [
  { id: "pointer", icon: MousePointer2, label: "Select" },
  { id: "text", icon: Type, label: "Text" },
  { id: "link", icon: Link2, label: "Add URL" },
  { id: "image", icon: ImageIcon, label: "Image" },
  { id: "signature", icon: PenTool, label: "Sign" },
  { id: "highlight", icon: Highlighter, label: "Highlight" },
  { id: "draw", icon: Pencil, label: "Draw" },
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "move", icon: Move, label: "Move" },
];

const fontSizeOptions = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

interface ToolsPanelProps {
  isSmallWidth: boolean;
}

export function ToolsPanel({ isSmallWidth }: ToolsPanelProps) {
  const {
    settings,
    document,
    closeDocument,
    setSidebarCollapse,
    setActiveTool,
    setCurrentTextStyle,
    setCurrentRectangleStyle,
    setBrushSettings,
    updateAnnotation,
    selectAnnotation,
  } = usePDFStore();
  const {
    activeTool,
    currentTextStyle,
    brushSettings,
    selectedAnnotationId,
    selectedAnnotationPageId,
    currentRectangleStyle,
  } = settings;
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const selectedAnn =
    selectedAnnotationId && selectedAnnotationPageId
      ? (
          document.modifications.annotations[selectedAnnotationPageId] || []
        ).find((a) => a.id === selectedAnnotationId)
      : null;
  const isEditingTextAnn = selectedAnn?.type === "text";
  const isEditingRectAnn = selectedAnn?.type === "rectangle";
  const editStyle =
    isEditingTextAnn && selectedAnn?.textStyle ? selectedAnn.textStyle : null;
  const activeStyle = editStyle || currentTextStyle;
  const editRectStyle =
    isEditingRectAnn && selectedAnn?.rectStyle ? selectedAnn.rectStyle : null;
  const activeRectStyle = editRectStyle || currentRectangleStyle;
  const showTextOptions = activeTool === "text" || isEditingTextAnn;
  const showHighlightOptions = activeTool === "highlight";
  const showDrawOptions = activeTool === "draw";
  const showRectOptions = activeTool === "rectangle" || isEditingRectAnn;

  const currentFontDef =
    availableFonts.find((f) => f.name === activeStyle.fontFamily) ||
    availableFonts[0];

  const handleStyleChange = (updates: Record<string, any>) => {
    if (
      isEditingTextAnn &&
      selectedAnnotationPageId &&
      selectedAnnotationId &&
      selectedAnn
    ) {
      updateAnnotation(selectedAnnotationPageId, selectedAnnotationId, {
        textStyle: {
          ...(selectedAnn.textStyle || defaultTextStyle),
          ...updates,
        },
      });
    } else {
      setCurrentTextStyle(updates);
    }
  };

  const handleRectChange = (updates: Record<string, any>) => {
    if (
      isEditingRectAnn &&
      selectedAnnotationPageId &&
      selectedAnnotationId &&
      selectedAnn
    ) {
      updateAnnotation(selectedAnnotationPageId, selectedAnnotationId, {
        rectStyle: {
          ...(selectedAnn.rectStyle || defaultRectangleStyle),
          ...updates,
        },
      });
    } else {
      setCurrentRectangleStyle(updates);
    }
  };

  const getActiveToolColor = () => {
    if (showTextOptions) return activeStyle.color;
    if (showHighlightOptions) return brushSettings.highlightColor;
    if (showDrawOptions) return brushSettings.drawColor;
    if (showRectOptions) return activeRectStyle.fillColor;
    return "#000000";
  };

  const handleToolColorChange = (color: string) => {
    if (showTextOptions) handleStyleChange({ color });
    else if (showHighlightOptions) setBrushSettings({ highlightColor: color });
    else if (showDrawOptions) setBrushSettings({ drawColor: color });
    else if (showRectOptions) handleRectChange({ fillColor: color });
  };

  const showColorPicker =
    showTextOptions ||
    showHighlightOptions ||
    showDrawOptions ||
    showRectOptions;

  const handleGoHome = () => {
    if (!usePDFStore.getState().haveUnsavedChanges()) {
      closeDocument();
      return;
    }
    setShowExitConfirm(true);
  };

  return (
    <div className="py-3 space-y-3 mb-10">
      {showColorPicker && (
        <div className="mx-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted) block mb-1.5">
            Color
          </span>
          <label className="flex items-center w-full h-9 rounded-lg border border-(--color-border) cursor-pointer overflow-hidden transition-all hover:border-primary relative">
            <div
              className="w-full h-full rounded-lg"
              style={{ backgroundColor: getActiveToolColor() }}
            ></div>
            <input
              type="color"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value={getActiveToolColor()}
              onChange={(e) => handleToolColorChange(e.target.value)}
            />
          </label>
        </div>
      )}

      {showTextOptions && (
        <div className="mx-3">
          <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
              {isEditingTextAnn ? "Edit Text" : "Text Style"}
            </span>
            <select
              className="w-full px-2 py-1.5 rounded-lg border border-(--color-border) bg-(--color-bg-panel) text-(--color-text-main) text-xs outline-none focus:border-primary"
              value={activeStyle.fontFamily}
              onChange={(e) =>
                handleStyleChange({ fontFamily: e.target.value })
              }
            >
              {availableFonts.map((f) => (
                <option
                  key={f.name}
                  value={f.name}
                  style={{ fontFamily: f.webFamily }}
                >
                  {f.name}
                </option>
              ))}
            </select>
            <select
              className="w-full px-2 py-1.5 rounded-lg border border-(--color-border) bg-(--color-bg-panel) text-(--color-text-main) text-xs outline-none focus:border-primary"
              value={activeStyle.fontSize}
              onChange={(e) =>
                handleStyleChange({ fontSize: Number(e.target.value) })
              }
            >
              {fontSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <button
                className={`flex-1 p-1.5 rounded-lg transition-all flex items-center justify-center ${!currentFontDef.supportsBold ? "opacity-30 cursor-not-allowed" : activeStyle.bold ? "bg-primary text-white" : "bg-(--color-bg-panel) text-(--color-text-muted) border border-(--color-border)"}`}
                onClick={() => {
                  if (currentFontDef.supportsBold)
                    handleStyleChange({ bold: !activeStyle.bold });
                }}
                disabled={!currentFontDef.supportsBold}
                title={
                  currentFontDef.supportsBold
                    ? "Bold"
                    : "Not supported for this font"
                }
              >
                <Bold size={14} />
              </button>
              <button
                className={`flex-1 p-1.5 rounded-lg transition-all flex items-center justify-center ${!currentFontDef.supportsItalic ? "opacity-30 cursor-not-allowed" : activeStyle.italic ? "bg-primary text-white" : "bg-(--color-bg-panel) text-(--color-text-muted) border border-(--color-border)"}`}
                onClick={() => {
                  if (currentFontDef.supportsItalic)
                    handleStyleChange({ italic: !activeStyle.italic });
                }}
                disabled={!currentFontDef.supportsItalic}
                title={
                  currentFontDef.supportsItalic
                    ? "Italic"
                    : "Not supported for this font"
                }
              >
                <Italic size={14} />
              </button>
              <button
                className={`flex-1 p-1.5 rounded-lg transition-all flex items-center justify-center ${activeStyle.underline ? "bg-primary text-white" : "bg-(--color-bg-panel) text-(--color-text-muted) border border-(--color-border)"}`}
                onClick={() =>
                  handleStyleChange({ underline: !activeStyle.underline })
                }
              >
                <Underline size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showHighlightOptions && (
        <div className="mx-3">
          <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
              Highlight
            </span>
            <div>
              <span className="text-[10px] text-(--color-text-muted) block mb-1">
                Size: {brushSettings.highlightSize}px
              </span>
              <input
                type="range"
                min="8"
                max="100"
                value={brushSettings.highlightSize}
                onChange={(e) =>
                  setBrushSettings({ highlightSize: Number(e.target.value) })
                }
                className="w-full h-1.5 rounded-full appearance-none bg-(--color-border) accent-primary"
              />
            </div>
          </div>
        </div>
      )}

      {showDrawOptions && (
        <div className="mx-3">
          <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
              Draw
            </span>
            <div>
              <span className="text-[10px] text-(--color-text-muted) block mb-1">
                Size: {brushSettings.drawSize}px
              </span>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSettings.drawSize}
                onChange={(e) =>
                  setBrushSettings({ drawSize: Number(e.target.value) })
                }
                className="w-full h-1.5 rounded-full appearance-none bg-(--color-border) accent-primary"
              />
            </div>
          </div>
        </div>
      )}

      {showRectOptions && (
        <div className="mx-3">
          <div className="bg-(--color-bg-app) border border-(--color-border) rounded-xl p-3 space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-muted)">
              Rectangle
            </span>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-(--color-text-muted)">
                Draw Outline
              </span>
              <input
                type="checkbox"
                checked={activeRectStyle.outlineOnly}
                onChange={(e) =>
                  handleRectChange({ outlineOnly: e.target.checked })
                }
                className="accent-primary w-4 h-4"
              />
            </label>
            <div>
              <span className="text-[10px] text-(--color-text-muted) block mb-1">
                Outline Width: {activeRectStyle.borderWidth}px
              </span>
              <input
                type="range"
                min="1"
                max="10"
                value={activeRectStyle.borderWidth}
                onChange={(e) =>
                  handleRectChange({
                    borderWidth: Number(e.target.value),
                  })
                }
                className="w-full h-1.5 rounded-full appearance-none bg-(--color-border) accent-primary"
              />
            </div>
            <div>
              <span className="text-[10px] text-(--color-text-muted) block mb-1">
                Opacity: {Math.round(activeRectStyle.opacity * 100)}%
              </span>
              <input
                type="range"
                min="5"
                max="100"
                value={Math.round(activeRectStyle.opacity * 100)}
                onChange={(e) =>
                  handleRectChange({
                    opacity: Number(e.target.value) / 100,
                  })
                }
                className="w-full h-1.5 rounded-full appearance-none bg-(--color-border) accent-primary"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 px-3">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              className={`py-2.5 px-3 w-full rounded-lg flex items-center gap-3 text-sm font-medium transition-all border ${isActive ? "border-primary text-primary bg-(--color-bg-active) shadow-sm" : "border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main)"}`}
              onClick={() => {
                if (activeTool === t.id) return;
                setActiveTool(t.id);
                if (isSmallWidth) setSidebarCollapse(true);
                if (t.id !== "text") selectAnnotation(null, null);
              }}
            >
              <Icon size={18} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-0 py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all">
        <button
          onClick={handleGoHome}
          className="w-full py-2.5 px-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all bg-(--color-bg-panel) text-(--color-text-muted) hover:bg-(--color-bg-hover) hover:text-(--color-text-main)"
        >
          <ChevronLeft size={18} />
          Go back
        </button>
      </div>
      <ConfirmationModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => {
          closeDocument();
          setShowExitConfirm(false);
        }}
        title="Discard Changes?"
        description="You have unsaved changes. Are you sure you want to discard them and return to the home screen?"
        confirmLabel="Discard Changes"
        variant="danger"
      />
    </div>
  );
}
