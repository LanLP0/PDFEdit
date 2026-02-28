import { create } from 'zustand';

// The Move tool is a dummy tool used to activate the touchmove block for mobile users. Other tools function in the editor as expected.
export type ToolType = 'pointer' | 'text' | 'image' | 'signature' | 'highlight' | 'draw' | 'link' | 'move';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
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
  type: 'text' | 'image' | 'signature' | 'highlight' | 'draw' | 'link';
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

export interface DocumentState {
  originalFile: File | null;
  fileName: string;
  fileExtension: string;
  originalBytes: ArrayBuffer | null;
  modifications: Modifications;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'adaptive';
  sidebarMode: 'tools' | 'thumbnails';
  activeTool: ToolType;
  currentTextStyle: TextStyle;
  brushSettings: BrushSettings;
  zoom: number;
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
  undo: () => void;
  redo: () => void;

  setTheme: (theme: AppSettings['theme']) => void;
  setSidebarMode: (mode: AppSettings['sidebarMode']) => void;
  setActiveTool: (tool: ToolType) => void;
  setCurrentTextStyle: (style: Partial<TextStyle>) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  setZoom: (zoom: number) => void;
  selectAnnotation: (pageId: string | null, annId: string | null) => void;

  loadDocument: (file: File, bytes: ArrayBuffer, initialPages: string[]) => void;
  renameDocument: (newName: string) => void;
  updatePageOrder: (newOrder: string[]) => void;
  rotatePage: (pageId: string, degree: number) => void;
  deletePage: (pageId: string) => void;

  addAnnotation: (pageId: string, annotation: Annotation) => void;
  updateAnnotation: (pageId: string, annotationId: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (pageId: string, annotationId: string) => void;

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
};

const initialSettings: AppSettings = {
  theme: 'adaptive',
  sidebarMode: 'tools',
  activeTool: 'pointer',
  currentTextStyle: { ...defaultTextStyle },
  brushSettings: { ...defaultBrushSettings },
  zoom: 100,
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

  // --- Undo / Redo ---
  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
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
    if (state.redoStack.length === 0) return state;
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

  // --- Settings (no undo tracking) ---
  setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
  setSidebarMode: (sidebarMode) => set((state) => ({ settings: { ...state.settings, sidebarMode } })),
  setActiveTool: (activeTool) => set((state) => ({ settings: { ...state.settings, activeTool } })),
  setCurrentTextStyle: (style) => set((state) => ({
    settings: { ...state.settings, currentTextStyle: { ...state.settings.currentTextStyle, ...style } }
  })),
  setBrushSettings: (bs) => set((state) => ({
    settings: { ...state.settings, brushSettings: { ...state.settings.brushSettings, ...bs } }
  })),
  setZoom: (zoom) => set((state) => ({ settings: { ...state.settings, zoom: Math.max(25, Math.min(400, zoom)) } })),
  selectAnnotation: (pageId, annId) => set((state) => ({
    settings: { ...state.settings, selectedAnnotationId: annId, selectedAnnotationPageId: pageId }
  })),

  // --- Document mutations (with undo tracking) ---
  loadDocument: (file, bytes, initialPages) => set(() => {
    const dotIdx = file.name.lastIndexOf('.');
    const name = dotIdx > 0 ? file.name.substring(0, dotIdx) : file.name;
    const ext = dotIdx > 0 ? file.name.substring(dotIdx) : '.pdf';
    return {
      document: { originalFile: file, fileName: name, fileExtension: ext, originalBytes: bytes, modifications: { pageOrder: initialPages, rotations: {}, annotations: {}, deletedPages: [] } },
      settings: { ...initialSettings, theme: get().settings.theme },
      undoStack: [],
      redoStack: [],
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
    set({
      document: { ...state.document, modifications: { ...mods, deletedPages: [...mods.deletedPages, pageId], pageOrder: mods.pageOrder.filter(id => id !== pageId) } },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  addAnnotation: (pageId, annotation) => {
    const state = get();
    const mods = state.document.modifications;
    const snapshot = cloneMods(mods);
    const currentAnns = mods.annotations[pageId] || [];
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
    const snapshot = cloneMods(mods);
    const currentAnns = mods.annotations[pageId] || [];
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
    const snapshot = cloneMods(mods);
    const currentAnns = mods.annotations[pageId] || [];
    set({
      document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.filter(ann => ann.id !== annotationId) } } },
      settings: { ...state.settings, selectedAnnotationId: null, selectedAnnotationPageId: null },
      undoStack: [...state.undoStack, snapshot].slice(-MAX_HISTORY),
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  closeDocument: () => set((state) => ({
    document: initialDocumentState,
    settings: { ...state.settings, sidebarMode: 'tools', activeTool: 'pointer', zoom: 100, selectedAnnotationId: null, selectedAnnotationPageId: null },
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  })),
}));
