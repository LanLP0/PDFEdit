import React from 'react';
import { usePDFStore } from '../../store/usePDFStore';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const theme = usePDFStore((state) => state.settings.theme);

    // Apply theme to root element for CSS variables
    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <div className="flex h-full w-full">
            {/* Sidebar will attach on the left */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {children}
            </main>
        </div>
    );
}
