import { create } from 'zustand';
import { themeSynced } from '../lib/PersistentStorage';

// The Move tool is a dummy tool used to activate the touchmove block for mobile users. Other tools function in the editor as expected.
export type ToolType = 'pointer' | 'text' | 'image' | 'signature' | 'highlight' | 'draw' | 'link' | 'move' | 'rectangle';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

export interface RectangleStyle {
  fillColor: string;
  outlineOnly: boolean;
  borderWidth: number;
  opacity: number;
}

// Font definitions with variant support info
export interface FontDef {
  name: string;
  webFamily: string; // CSS font-family stack
  supportsBold: boolean;
  supportsItalic: boolean;
  supportsBoldItalic: boolean;
}

export const availableFonts: FontDef[] = [
  { name: 'Helvetica', webFamily: 'Helvetica, Arial, sans-serif', supportsBold: true, supportsItalic: true, supportsBoldItalic: true },
  { name: 'Times Roman', webFamily: '"Times New Roman", Times, serif', supportsBold: true, supportsItalic: true, supportsBoldItalic: true },
  { name: 'Courier', webFamily: '"Courier New", Courier, monospace', supportsBold: true, supportsItalic: true, supportsBoldItalic: true },
];

export const defaultTextStyle: TextStyle = {
  fontFamily: 'Helvetica',
  fontSize: 16,
  bold: false,
  italic: false,
  underline: false,
  color: '#000000',
};

export const defaultRectangleStyle: RectangleStyle = {
  fillColor: '#000000',
  outlineOnly: false,
  borderWidth: 2,
  opacity: 1,
};

export interface StrokePoint {
  x: number;
  y: number;
}

export interface LinkPayload {
  text: string;
  url: string;
}

export interface Annotation {
  id: string;
  type: 'text' | 'image' | 'signature' | 'highlight' | 'draw' | 'link' | 'rectangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  payload: any;
  textStyle?: TextStyle;
  points?: StrokePoint[];
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  // Rectangle-specific
  rectWidth?: number;
  rectHeight?: number;
  rectStyle?: RectangleStyle;
}

export interface BrushSettings {
  highlightSize: number;
  highlightColor: string;
  drawSize: number;
  drawColor: string;
}

export const defaultBrushSettings: BrushSettings = {
  highlightSize: 20,
  highlightColor: '#FFFF00',
  drawSize: 3,
  drawColor: '#000000',
};

export interface Modifications {
  pageOrder: string[];
  rotations: Record<string, number>;
  annotations: Record<string, Annotation[]>;
  deletedPages: string[];
}

export interface Bookmark {
  id: string;
  title: string;
  pageId: string; // references pageOrder IDs, e.g. "page-3"
}

export interface OutlineItem {
  title: string;
  pageId: string;
  children: OutlineItem[];
}

export interface DocumentState {
  originalFile: File | null;
  fileName: string;
  fileExtension: string;
  originalBytes: ArrayBuffer | null;
  modifications: Modifications;
  outline: OutlineItem[];
  bookmarks: Bookmark[];
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'adaptive';
  sidebarMode: 'tools' | 'thumbnails' | 'bookmarks';
  activeTool: ToolType;
  currentTextStyle: TextStyle;
  currentRectangleStyle: RectangleStyle;
  brushSettings: BrushSettings;
  zoom: number;
  sidebarCollapse: boolean;
  selectedAnnotationId: string | null;
  selectedAnnotationPageId: string | null;
}

const MAX_HISTORY = 50;

interface PDFStore {
  document: DocumentState;
  settings: AppSettings;

  // Undo/Redo
  undoStack: Modifications[];
  redoStack: Modifications[];
  canUndo: boolean;
  canRedo: boolean;
  changedSinceLastUndo: Boolean;
  recordingUndo: boolean;
  undo: () => void;
  redo: () => void;
  suspendRecordingUndo: () => void;
  resumeRecordingUndo: () => void;

  setTheme: (theme: AppSettings['theme']) => void;
  setSidebarMode: (mode: AppSettings['sidebarMode']) => void;
  setActiveTool: (tool: ToolType) => void;
  setCurrentTextStyle: (style: Partial<TextStyle>) => void;
  setCurrentRectangleStyle: (style: Partial<RectangleStyle>) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  setZoom: (zoom: number) => void;
  setSidebarCollapse: (sidebarCollapse: boolean) => void;
  selectAnnotation: (pageId: string | null, annId: string | null) => void;

  loadDocument: (file: File, bytes: ArrayBuffer, initialPages: string[]) => void;
  renameDocument: (newName: string) => void;
  updatePageOrder: (newOrder: string[]) => void;
  rotatePage: (pageId: string, degree: number) => void;
  deletePage: (pageId: string) => void;
  mergeFile: (file: File) => Promise<void>;

  addAnnotation: (pageId: string, annotation: Annotation) => void;
  updateAnnotation: (pageId: string, annotationId: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (pageId: string, annotationId: string) => void;

  // Bookmarks
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmarkId: string, updates: Partial<Omit<Bookmark, 'id'>>) => void;

  haveUnsavedChanges: () => boolean;
  closeDocument: () => void;
}

const emptyModifications: Modifications = {
  pageOrder: [], rotations: {}, annotations: {}, deletedPages: []
};

const initialDocumentState: DocumentState = {
  originalFile: null,
  fileName: '',
  fileExtension: '.pdf',
  originalBytes: null,
  modifications: { ...emptyModifications },
  outline: [],
  bookmarks: [],
};

const initialSettings: AppSettings = {
  theme: themeSynced.get(),
  sidebarMode: 'tools',
  activeTool: 'pointer',
  currentTextStyle: { ...defaultTextStyle },
  currentRectangleStyle: { ...defaultRectangleStyle },
  brushSettings: { ...defaultBrushSettings },
  zoom: 100,
  sidebarCollapse: false,
  selectedAnnotationId: null,
  selectedAnnotationPageId: null,
};

// Deep clone modifications for undo/redo snapshots
function cloneMods(m: Modifications): Modifications {
  return {
    pageOrder: [...m.pageOrder],
    rotations: { ...m.rotations },
    annotations: Object.fromEntries(
      Object.entries(m.annotations).map(([k, v]) => [k, v.map(a => ({ ...a, points: a.points ? [...a.points] : undefined, textStyle: a.textStyle ? { ...a.textStyle } : undefined }))])
    ),
    deletedPages: [...m.deletedPages],
  };
}

export const usePDFStore = create<PDFStore>()((set, get) => ({
  document: initialDocumentState,
  settings: initialSettings,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  changedSinceLastUndo: false, // This value is only used to check when suspending recording undo, as normally all changes will be recorded
  recordingUndo: true,

  // --- Undo / Redo ---
  undo: () => set((state) => {
    if (!state.canUndo && state.undoStack.length === 0) return state;
    const prev = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    const newRedoStack = [...state.redoStack, cloneMods(state.document.modifications)].slice(-MAX_HISTORY);
    return {
      document: { ...state.document, modifications: prev },
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      canUndo: newUndoStack.length > 0,
      canRedo: true,
    };
  }),

  redo: () => set((state) => {
    if (!state.canRedo && state.redoStack.length === 0) return state;
    const next = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    const newUndoStack = [...state.undoStack, cloneMods(state.document.modifications)].slice(-MAX_HISTORY);
    return {
      document: { ...state.document, modifications: next },
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      canUndo: true,
      canRedo: newRedoStack.length > 0,
    };
  }),

  suspendRecordingUndo: () => {
    const state = get();
    if (!state.recordingUndo) return;
    console.log("RecordingUndo Suspended");

    if (state.changedSinceLastUndo) {
      set({
        undoStack: [...state.undoStack, cloneMods(state.document.modifications)].slice(-MAX_HISTORY),
      })
    }

    set({
      recordingUndo: false,
      canUndo: false,
      canRedo: false,
      changedSinceLastUndo: false,
    });
  },

  resumeRecordingUndo: () => {
    const state = get();
    if (state.recordingUndo) return;
    console.log("RecordingUndo Resumed");

    if (state.changedSinceLastUndo) {
      set({
        redoStack: [], // Release the redo stack because this previous state in unrecorded
      })
    }

    set({
      recordingUndo: true,
      canUndo: state.undoStack.length > 0,
      canRedo: state.redoStack.length > 0,
    });
  },

  // --- Settings (no undo tracking) ---
  setTheme: (theme) => { if (theme === get().settings.theme) return; set((state) => ({ settings: { ...state.settings, theme } })); themeSynced.set(theme); },
  setSidebarMode: (sidebarMode) => set((state) => ({ settings: { ...state.settings, sidebarMode } })),
  setActiveTool: (activeTool) => set((state) => ({ settings: { ...state.settings, activeTool } })),
  setCurrentTextStyle: (style) => set((state) => ({
    settings: { ...state.settings, currentTextStyle: { ...state.settings.currentTextStyle, ...style } }
  })),
  setCurrentRectangleStyle: (style) => set((state) => ({
    settings: { ...state.settings, currentRectangleStyle: { ...state.settings.currentRectangleStyle, ...style } }
  })),
  setBrushSettings: (bs) => set((state) => ({
    settings: { ...state.settings, brushSettings: { ...state.settings.brushSettings, ...bs } }
  })),
  setZoom: (zoom) => set((state) => ({ settings: { ...state.settings, zoom: Math.max(25, Math.min(400, zoom)) } })),
  setSidebarCollapse: (sidebarCollapse) => set((state) => ({ settings: { ...state.settings, sidebarCollapse } })),
  selectAnnotation: (pageId, annId) => set((state) => ({
    settings: { ...state.settings, selectedAnnotationId: annId, selectedAnnotationPageId: pageId }
  })),

  // --- Document mutations (with undo tracking) ---
  loadDocument: (file, bytes, initialPages) => set(() => {
    const dotIdx = file.name.lastIndexOf('.');
    const name = dotIdx > 0 ? file.name.substring(0, dotIdx) : file.name;
    const ext = dotIdx > 0 ? file.name.substring(dotIdx) : '.pdf';
    return {
      document: { originalFile: file, fileName: name, fileExtension: ext, originalBytes: bytes, modifications: { pageOrder: initialPages, rotations: {}, annotations: {}, deletedPages: [] }, outline: [], bookmarks: [] },
      settings: { ...initialSettings, theme: get().settings.theme },
      undoStack: [],
      redoStack: [],
      changedSinceLastUndo: false,
      recordingUndo: true,
      canUndo: false,
      canRedo: false,
    };
  }),

  renameDocument: (newName) => set((state) => ({
    document: { ...state.document, fileName: newName }
  })),

  updatePageOrder: (newOrder) => {
    const state = get();
    const snapshot = cloneMods(state.document.modifications);
    state.changedSinceLastUndo = true;
    if (!state.recordingUndo) {
      // Update document (still display) but not the undo stack
      set({
        document: { ...state.document, modifications: { ...state.document.modifications, pageOrder: newOrder } },
        redoStack: [],
        canUndo: false,
        canRedo: false,
      });
      return;
    }
    set({
      document: { ...state.document, modifications: { ...state.document.modifications, pageOrder: newOrder } },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  rotatePage: (pageId, degree) => {
    const state = get();
    const snapshot = cloneMods(state.document.modifications);
    const currentRot = state.document.modifications.rotations[pageId] || 0;
    let newRot = (currentRot + degree) % 360;
    if (newRot < 0) newRot += 360;
    state.changedSinceLastUndo = true;
    if (!state.recordingUndo) {
      // Update document (still display) but not the undo stack
      set({
        document: { ...state.document, modifications: { ...state.document.modifications, rotations: { ...state.document.modifications.rotations, [pageId]: newRot } } },
        redoStack: [],
        canUndo: false,
        canRedo: false,
      });
      return;
    }
    set({
      document: { ...state.document, modifications: { ...state.document.modifications, rotations: { ...state.document.modifications.rotations, [pageId]: newRot } } },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  deletePage: (pageId) => {
    const state = get();
    const mods = state.document.modifications;
    const snapshot = cloneMods(mods);
    state.changedSinceLastUndo = true;
    // Auto-remove bookmarks pointing to the deleted page
    const filteredBookmarks = state.document.bookmarks.filter(b => b.pageId !== pageId);
    if (!state.recordingUndo) {
      set({
        document: { ...state.document, bookmarks: filteredBookmarks, modifications: { ...mods, deletedPages: [...mods.deletedPages, pageId], pageOrder: mods.pageOrder.filter(id => id !== pageId) } },
        redoStack: [],
        canUndo: false,
        canRedo: false,
      });
      return;
    }
    set({
      document: { ...state.document, bookmarks: filteredBookmarks, modifications: { ...mods, deletedPages: [...mods.deletedPages, pageId], pageOrder: mods.pageOrder.filter(id => id !== pageId) } },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  mergeFile: async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false }); // TODO: maybe this part can be optimized
      const numPages = pdfDoc.getPageCount();

      const currentBytes = usePDFStore.getState().document.originalBytes;
      if (!currentBytes) return;

      const originalPdf = await PDFDocument.load(currentBytes);
      const currentPageCount = originalPdf.getPageCount();

      const mergePdf = await PDFDocument.load(buffer);
      const copiedPages = await originalPdf.copyPages(mergePdf, mergePdf.getPageIndices());
      copiedPages.forEach((page) => originalPdf.addPage(page));
      const mergedBytes = await originalPdf.save();

      // Create page IDs using the format "page-N" where N is 1-based index
      // in the combined PDF. This way the export function can correctly find them.
      const newPageIds = Array.from({ length: numPages }, (_, i) => `page-${currentPageCount + i + 1}`);

      set((state) => {
        const snapshot = cloneMods(state.document.modifications);
        state.changedSinceLastUndo = true;
        if (!state.recordingUndo) {
          // Update document (still display) but not the undo stack
          return {
            document: {
              ...state.document,
              originalBytes: mergedBytes.buffer as ArrayBuffer,
              modifications: {
                ...state.document.modifications,
                pageOrder: [...state.document.modifications.pageOrder, ...newPageIds]
              }
            },
            redoStack: [],
            canUndo: false,
            canRedo: false,
          };
        }
        return {
          document: {
            ...state.document,
            originalBytes: mergedBytes.buffer as ArrayBuffer,
            modifications: {
              ...state.document.modifications,
              pageOrder: [...state.document.modifications.pageOrder, ...newPageIds]
            }
          },
          undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
          redoStack: [],
          canUndo: true,
          canRedo: false,
        };
      });
    } catch (e) { console.error("Merge failed:", e); alert("Failed to merge PDF"); }
  },

  addAnnotation: (pageId, annotation) => {
    const state = get();
    const mods = state.document.modifications;
    const currentAnns = mods.annotations[pageId] || [];
    const snapshot = cloneMods(mods);
    state.changedSinceLastUndo = true;
    if (!state.recordingUndo) {
      // Update document (still display) but not the undo stack
      set({
        document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: [...currentAnns, annotation] } } },
        redoStack: [],
        canUndo: false,
        canRedo: false,
      });
      return;
    }
    set({
      document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: [...currentAnns, annotation] } } },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  updateAnnotation: (pageId, annotationId, updates) => {
    const state = get();
    const mods = state.document.modifications;
    const currentAnns = mods.annotations[pageId] || [];
    const snapshot = cloneMods(mods);
    state.changedSinceLastUndo = true;
    if (!state.recordingUndo) {
      // Update document (still display) but not the undo stack
      set({
        document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.map(ann => ann.id === annotationId ? { ...ann, ...updates } : ann) } } },
        redoStack: [],
        canUndo: false,
        canRedo: false,
      });
      return;
    }
    set({
      document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.map(ann => ann.id === annotationId ? { ...ann, ...updates } : ann) } } },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  deleteAnnotation: (pageId, annotationId) => {
    const state = get();
    const mods = state.document.modifications;
    const currentAnns = mods.annotations[pageId] || [];
    const snapshot = cloneMods(mods);
    state.changedSinceLastUndo = true;
    if (!state.recordingUndo) {
      // Update document (still display) but not the undo stack
      set({
        document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.filter(ann => ann.id !== annotationId) } } },
        redoStack: [],
        canUndo: false,
        canRedo: false,
      });
      return;
    }
    set({
      document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.filter(ann => ann.id !== annotationId) } } },
      settings: { ...state.settings, selectedAnnotationId: null, selectedAnnotationPageId: null },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  // --- Bookmarks (no undo tracking) ---
  addBookmark: (bookmark) => set((state) => ({
    document: { ...state.document, bookmarks: [...state.document.bookmarks, bookmark] }
  })),
  removeBookmark: (bookmarkId) => set((state) => ({
    document: { ...state.document, bookmarks: state.document.bookmarks.filter(b => b.id !== bookmarkId) }
  })),
  updateBookmark: (bookmarkId, updates) => set((state) => ({
    document: { ...state.document, bookmarks: state.document.bookmarks.map(b => b.id === bookmarkId ? { ...b, ...updates } : b) }
  })),

  haveUnsavedChanges: () => {
    const state = get();
    if (!state.document.originalBytes) return false;

    const hasModifications =
      Object.keys(state.document.modifications.rotations).length > 0 ||
      Object.keys(state.document.modifications.annotations).length > 0 ||
      state.document.modifications.deletedPages.length > 0;

    return hasModifications;
  },

  closeDocument: () => set((state) => ({
    document: initialDocumentState,
    settings: { ...state.settings, sidebarMode: 'tools', activeTool: 'pointer', zoom: 100, selectedAnnotationId: null, selectedAnnotationPageId: null },
    undoStack: [],
    redoStack: [],
    changedSinceLastUndo: false,
    recordingUndo: true,
    canUndo: false,
    canRedo: false,
  })),
}));
