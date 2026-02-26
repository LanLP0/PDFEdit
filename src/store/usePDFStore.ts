import { create } from 'zustand';

export type ToolType = 'pointer' | 'text' | 'image' | 'signature' | 'highlight' | 'draw';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

export const defaultTextStyle: TextStyle = {
  fontFamily: 'Inter',
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

export interface Annotation {
  id: string;
  type: 'text' | 'image' | 'signature' | 'highlight' | 'draw';
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
  drawSize: number;
}

export const defaultBrushSettings: BrushSettings = {
  highlightSize: 20,
  drawSize: 3,
};

export interface DocumentState {
  originalFile: File | null;
  originalBytes: ArrayBuffer | null;
  modifications: {
    pageOrder: string[];
    rotations: Record<string, number>;
    annotations: Record<string, Annotation[]>;
    deletedPages: string[];
  };
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'adaptive';
  sidebarMode: 'tools' | 'thumbnails';
  activeTool: ToolType;
  currentTextStyle: TextStyle;
  brushSettings: BrushSettings;
  activeColor: string; // unified color for all tools
  zoom: number;
  selectedAnnotationId: string | null;
  selectedAnnotationPageId: string | null;
}

interface PDFStore {
  document: DocumentState;
  settings: AppSettings;

  setTheme: (theme: AppSettings['theme']) => void;
  setSidebarMode: (mode: AppSettings['sidebarMode']) => void;
  setActiveTool: (tool: ToolType) => void;
  setCurrentTextStyle: (style: Partial<TextStyle>) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  setActiveColor: (color: string) => void;
  setZoom: (zoom: number) => void;
  selectAnnotation: (pageId: string | null, annId: string | null) => void;

  loadDocument: (file: File, bytes: ArrayBuffer, initialPages: string[]) => void;
  updatePageOrder: (newOrder: string[]) => void;
  rotatePage: (pageId: string, degree: number) => void;
  deletePage: (pageId: string) => void;

  addAnnotation: (pageId: string, annotation: Annotation) => void;
  updateAnnotation: (pageId: string, annotationId: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (pageId: string, annotationId: string) => void;

  closeDocument: () => void;
}

const initialDocumentState: DocumentState = {
  originalFile: null,
  originalBytes: null,
  modifications: { pageOrder: [], rotations: {}, annotations: {}, deletedPages: [] }
};

const initialSettings: AppSettings = {
  theme: 'adaptive',
  sidebarMode: 'tools',
  activeTool: 'pointer',
  currentTextStyle: { ...defaultTextStyle },
  brushSettings: { ...defaultBrushSettings },
  activeColor: '#000000',
  zoom: 100,
  selectedAnnotationId: null,
  selectedAnnotationPageId: null,
};

export const usePDFStore = create<PDFStore>()((set) => ({
  document: initialDocumentState,
  settings: initialSettings,

  setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
  setSidebarMode: (sidebarMode) => set((state) => ({ settings: { ...state.settings, sidebarMode } })),
  setActiveTool: (activeTool) => set((state) => ({ settings: { ...state.settings, activeTool } })),
  setCurrentTextStyle: (style) => set((state) => ({
    settings: { ...state.settings, currentTextStyle: { ...state.settings.currentTextStyle, ...style } }
  })),
  setBrushSettings: (bs) => set((state) => ({
    settings: { ...state.settings, brushSettings: { ...state.settings.brushSettings, ...bs } }
  })),
  setActiveColor: (activeColor) => set((state) => ({
    settings: { ...state.settings, activeColor, currentTextStyle: { ...state.settings.currentTextStyle, color: activeColor } }
  })),
  setZoom: (zoom) => set((state) => ({ settings: { ...state.settings, zoom: Math.max(25, Math.min(400, zoom)) } })),
  selectAnnotation: (pageId, annId) => set((state) => ({
    settings: { ...state.settings, selectedAnnotationId: annId, selectedAnnotationPageId: pageId }
  })),

  loadDocument: (file, bytes, initialPages) => set(() => ({
    document: { originalFile: file, originalBytes: bytes, modifications: { pageOrder: initialPages, rotations: {}, annotations: {}, deletedPages: [] } },
    settings: { ...initialSettings, theme: usePDFStore.getState().settings.theme }
  })),

  updatePageOrder: (newOrder) => set((state) => ({
    document: { ...state.document, modifications: { ...state.document.modifications, pageOrder: newOrder } }
  })),

  rotatePage: (pageId, degree) => set((state) => {
    const currentRot = state.document.modifications.rotations[pageId] || 0;
    const newRot = (currentRot + degree) % 360;
    return { document: { ...state.document, modifications: { ...state.document.modifications, rotations: { ...state.document.modifications.rotations, [pageId]: newRot < 0 ? newRot + 360 : newRot } } } };
  }),

  deletePage: (pageId) => set((state) => {
    const mods = state.document.modifications;
    return { document: { ...state.document, modifications: { ...mods, deletedPages: [...mods.deletedPages, pageId], pageOrder: mods.pageOrder.filter(id => id !== pageId) } } };
  }),

  addAnnotation: (pageId, annotation) => set((state) => {
    const mods = state.document.modifications;
    const currentAnns = mods.annotations[pageId] || [];
    return { document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: [...currentAnns, annotation] } } } };
  }),

  updateAnnotation: (pageId, annotationId, updates) => set((state) => {
    const mods = state.document.modifications;
    const currentAnns = mods.annotations[pageId] || [];
    return { document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.map(ann => ann.id === annotationId ? { ...ann, ...updates } : ann) } } } };
  }),

  deleteAnnotation: (pageId, annotationId) => set((state) => {
    const mods = state.document.modifications;
    const currentAnns = mods.annotations[pageId] || [];
    return {
      document: { ...state.document, modifications: { ...mods, annotations: { ...mods.annotations, [pageId]: currentAnns.filter(ann => ann.id !== annotationId) } } },
      settings: { ...state.settings, selectedAnnotationId: null, selectedAnnotationPageId: null }
    };
  }),

  closeDocument: () => set((state) => ({
    document: initialDocumentState,
    settings: { ...state.settings, sidebarMode: 'tools', activeTool: 'pointer', zoom: 100, selectedAnnotationId: null, selectedAnnotationPageId: null }
  })),
}));
