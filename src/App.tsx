import { useEffect, useState, useCallback, useRef } from 'react';
import { Layout } from './components/Layout/Layout';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ConfirmationModal } from './components/Modal/ConfirmationModal';
import { HomeScreen } from './features/HomeScreen/HomeScreen';
import { EditorScreen } from './features/EditorScreen/EditorScreen';
import { usePDFStore } from './store/usePDFStore';
import { openFile, openFilePath } from './lib/openFile';
import { isElectron, getElectronAPI } from './lib/electron';

function App() {
  const { document, settings, undo, redo, closeDocument } = usePDFStore();
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const onQuitConfirmed = useRef<(() => void) | null>(null);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      openFile(file);
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
        />
      </div>
    </Layout>
  );
}

function GlobalModals({ showQuitConfirm, setShowQuitConfirm, onQuitConfirmed }: {
  showQuitConfirm: boolean,
  setShowQuitConfirm: (v: boolean) => void,
  onQuitConfirmed: React.RefObject<(() => void) | null>
}) {
  return (
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
  );
}

export default App;
