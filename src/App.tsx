import { useEffect, useState } from 'react';
import { Layout } from './components/Layout/Layout';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { HomeScreen } from './features/HomeScreen/HomeScreen';
import { EditorScreen } from './features/EditorScreen/EditorScreen';
import { usePDFStore } from './store/usePDFStore';

function App() {
  const { document, settings } = usePDFStore();
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

  return (
    <Layout>
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
    </Layout>
  );
}

export default App;
