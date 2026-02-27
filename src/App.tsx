import { useEffect, useState, useCallback } from 'react';
import { Layout } from './components/Layout/Layout';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { HomeScreen } from './features/HomeScreen/HomeScreen';
import { EditorScreen } from './features/EditorScreen/EditorScreen';
import { usePDFStore } from './store/usePDFStore';
import { openFile, openFilePath } from './lib/openFile';
import { isElectron, getElectronAPI } from './lib/electron';

function App() {
  const { document, settings, undo, redo } = usePDFStore();
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);

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

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Also support Ctrl+Y for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
      </div>
    </Layout>
  );
}

export default App;
