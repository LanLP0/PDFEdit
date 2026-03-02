import { useEffect, useState, useCallback, useRef } from 'react';
import { Layout } from './components/Layout/Layout';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ConfirmationModal } from './components/Modal/ConfirmationModal';
import { HomeScreen } from './features/HomeScreen/HomeScreen';
import { EditorScreen } from './features/EditorScreen/EditorScreen';
import { usePDFStore } from './store/usePDFStore';
import { openFile, openFilePath, applyLoadedPdf, hasModifications, openFilePayload } from './lib/openFile';
import type { LoadedPdf } from './lib/openFile';
import { isElectron, getElectronAPI } from './lib/electron';
import { FileConflictModal } from './components/Modal/FileConflictModal';
import { ErrorModal } from './components/Modal/ErrorModal';
import { themeSynced, storageManager } from './lib/PersistentStorage';

function App() {
  const { document, settings, undo, redo, closeDocument } = usePDFStore();
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const onQuitConfirmed = useRef<(() => void) | null>(null);

  // File handling state
  const [incomingFile, setIncomingFile] = useState<LoadedPdf | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string } | null>(null);

  // Reset page index when document changes
  useEffect(() => { setVisiblePageIndex(0); }, [document.originalBytes]);

  // Handle adaptive theming
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      if (settings.theme === 'adaptive') {
        window.document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
      } else {
        window.document.documentElement.setAttribute('data-theme', settings.theme);
      }
    };
    applyTheme();
    const listener = (e: MediaQueryListEvent) => {
      if (settings.theme === 'adaptive') {
        window.document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [settings.theme]);

  // Cross-tab sync: theme & recent files
  useEffect(() => {
    storageManager.sync(); // initial hydration
    const unsubTheme = themeSynced.subscribe((theme) => {
      usePDFStore.getState().setTheme(theme);
    });
    return () => unsubTheme();
  }, []);

  // Global keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo(); else undo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key.toLowerCase() === 'q') {
          e.preventDefault();
          handleQuit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Handle prevent touchmove on mobile when annoting
  const [touchMoveHandlerAdded, setTouchMoveHandlerAdded] = useState(false);
  let tool = settings.activeTool;

  const preventTouchMove = useCallback((e: TouchEvent): void => {
    if (e.preventDefault) e.preventDefault();
  }, []);

  useEffect(() => {
    // These tools won't activate the touchmove block
    if (tool === 'pointer' || tool === 'text' || tool === 'link' || tool === 'signature') {
      if (!touchMoveHandlerAdded) return;

      // console.log('Removing touchmove block handler');
      window.document.removeEventListener('touchmove', preventTouchMove);
      setTouchMoveHandlerAdded(false);
      return;
    }

    if (touchMoveHandlerAdded) return;

    // console.log('Adding touchmove block handler');
    window.document.addEventListener('touchmove', preventTouchMove, { passive: false });
    setTouchMoveHandlerAdded(true);
  }, [tool])

  // Electron: listen for files opened via File menu or macOS Dock
  useEffect(() => {
    if (!isElectron) return;
    const cleanup = getElectronAPI().onOpenFile((filePath) => {
      openFilePath(filePath);
    });
    return cleanup;
  }, []);

  // App-level file drop handler
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      try {
        const pdf = await openFile(file);
        if (!pdf) return;

        if (hasModifications()) {
          setIncomingFile(pdf);
          setShowConflictModal(true);
        } else {
          await applyLoadedPdf(pdf);
        }
      } catch (err: any) {
        setErrorDetails({
          title: "Failed to Open File",
          message: err.message || "An error occurred while loading the PDF."
        });
      }
    }
  }, []);

  // Handle quit events
  useEffect(() => {
    const handleTabClose = (event: BeforeUnloadEvent) => {
      const state = usePDFStore.getState();
      if (!state.haveUnsavedChanges()) return;

      event.preventDefault();

      return (event.returnValue =
        'You have unsaved changes. Do you want to discard them and exit?');
    };

    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
    };
  }, []);

  // Desktop File Handler Integration
  useEffect(() => {
    if (!isElectron) return;
    const api = getElectronAPI();

    const cleanup1 = api.onOpenFile(async (filePath) => {
      try {
        const pdf = await openFilePath(filePath);
        if (!pdf) return;

        if (hasModifications()) {
          setIncomingFile(pdf);
          setShowConflictModal(true);
        } else {
          await applyLoadedPdf(pdf);
        }
      } catch (err: any) {
        setErrorDetails({
          title: "Failed to Open File",
          message: err.message || "An error occurred while loading the PDF."
        });
      }
    });

    const cleanup2 = api.onOpenFilePayload?.(async (data) => {
      try {
        const pdf = await openFilePayload(data);
        if (!pdf) return;

        if (hasModifications()) {
          setIncomingFile(pdf);
          setShowConflictModal(true);
        } else {
          await applyLoadedPdf(pdf);
        }
      } catch (err: any) {
        setErrorDetails({
          title: "Failed to Open Payload",
          message: err.message || "An error occurred while loading the PDF data."
        });
      }
    });

    return () => {
      cleanup1();
      cleanup2?.();
    };
  }, []);

  const handleDiscardAndOpen = useCallback(async () => {
    if (incomingFile) {
      await applyLoadedPdf(incomingFile);
      setIncomingFile(null);
      setShowConflictModal(false);
    }
  }, [incomingFile]);

  const handleOpenInNewWindow = useCallback(() => {
    if (incomingFile && isElectron) {
      // Enforce 50MB limit for direct bytes transfer if no path is available
      if (!incomingFile.path && incomingFile.buffer.byteLength > 50 * 1024 * 1024) {
        setErrorDetails({
          title: "File Too Large",
          message: "The file is too large (over 50MB) to be opened this way. Please save it locally first."
        });
        return;
      }

      getElectronAPI().openInNewWindow({
        path: incomingFile.path,
        bytes: new Uint8Array(incomingFile.buffer),
        name: incomingFile.name
      });
      setIncomingFile(null);
      setShowConflictModal(false);
    }
  }, [incomingFile]);

  // Universal Quit Handler
  const handleQuit = useCallback(() => {
    const state = usePDFStore.getState();
    if (!state.haveUnsavedChanges()) {
      closeDocument();
      if (isElectron) getElectronAPI().notifyCloseWindow();
      return;
    }

    onQuitConfirmed.current = () => {
      closeDocument();
      if (isElectron) getElectronAPI().notifyCloseWindow();
    };
    setShowQuitConfirm(true);
  }, [closeDocument]);

  // Electron Quit
  useEffect(() => {
    if (!isElectron) return;
    const api = getElectronAPI();
    const cleanup = api.onCloseRequested(handleQuit);

    return cleanup;
  }, [handleQuit]);

  return (
    <Layout>
      <div onDragOver={handleDragOver} onDrop={handleDrop} className="flex flex-col h-full">
        <Header />
        <div className="flex flex-1 overflow-hidden relative">
          {document.originalBytes ? (
            <>
              <Sidebar activePageIndex={visiblePageIndex} onPageSelect={setVisiblePageIndex} />
              <EditorScreen visiblePageIndex={visiblePageIndex} setVisiblePageIndex={setVisiblePageIndex} />
            </>
          ) : (
            <HomeScreen />
          )}
        </div>
        <GlobalModals
          showQuitConfirm={showQuitConfirm}
          setShowQuitConfirm={setShowQuitConfirm}
          onQuitConfirmed={onQuitConfirmed}
          incomingFile={incomingFile}
          showConflictModal={showConflictModal}
          setShowConflictModal={setShowConflictModal}
          handleDiscardAndOpen={handleDiscardAndOpen}
          handleOpenInNewWindow={handleOpenInNewWindow}
          errorDetails={errorDetails}
          setErrorDetails={setErrorDetails}
        />
      </div>
    </Layout>
  );
}

function GlobalModals({
  showQuitConfirm,
  setShowQuitConfirm,
  onQuitConfirmed,
  incomingFile,
  showConflictModal,
  setShowConflictModal,
  handleDiscardAndOpen,
  handleOpenInNewWindow,
  errorDetails,
  setErrorDetails
}: {
  showQuitConfirm: boolean,
  setShowQuitConfirm: (v: boolean) => void,
  onQuitConfirmed: React.RefObject<(() => void) | null>,
  incomingFile: LoadedPdf | null,
  showConflictModal: boolean,
  setShowConflictModal: (v: boolean) => void,
  handleDiscardAndOpen: () => void,
  handleOpenInNewWindow: () => void,
  errorDetails: { title: string; message: string } | null,
  setErrorDetails: (v: { title: string; message: string } | null) => void
}) {
  return (
    <>
      <ConfirmationModal
        isOpen={showQuitConfirm}
        onClose={() => setShowQuitConfirm(false)}
        onConfirm={() => {
          if (onQuitConfirmed.current) onQuitConfirmed.current();
          setShowQuitConfirm(false);
        }}
        title={isElectron ? "Discard Changes & Exit?" : "Discard Changes & Close?"}
        description={isElectron
          ? "You have unsaved changes. Are you sure you want to discard them and exit the application?"
          : "You have unsaved changes. Are you sure you want to discard them and close the current document?"}
        confirmLabel={isElectron ? "Exit Anyway" : "Discard & Close"}
        variant="danger"
      />

      <FileConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onDiscardAndOpen={handleDiscardAndOpen}
        onOpenInNewWindow={handleOpenInNewWindow}
        fileName={incomingFile?.name || "the document"}
      />

      <ErrorModal
        isOpen={!!errorDetails}
        onClose={() => setErrorDetails(null)}
        title={errorDetails?.title || "Error"}
        message={errorDetails?.message || "An unexpected error occurred."}
      />
    </>
  );
}

export default App;
