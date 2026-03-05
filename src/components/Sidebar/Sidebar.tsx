import { useState, useEffect } from 'react';
import { usePDFStore } from '../../store/usePDFStore';
import { Layers, Grid2X2, Bookmark } from 'lucide-react';
import { ToolsPanel } from './ToolsPanel';
import { PagesPanel } from './PagesPanel';
import { BookmarksPanel } from './BookmarksPanel';

interface SidebarProps {
    activePageIndex: number;
    onPageSelect: (index: number) => void;
}

type SidebarMode = 'tools' | 'thumbnails' | 'bookmarks';

export function Sidebar({ activePageIndex, onPageSelect }: SidebarProps) {
    const { settings, setSidebarMode, setSidebarCollapse } = usePDFStore();
    const { sidebarMode, sidebarCollapse } = settings;

    const [isSmallWidth, setIsSmallWidth] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 1023px)');
        const handler = (e: MediaQueryListEvent | MediaQueryList) => {
            const small = Boolean(e.matches);
            setSidebarCollapse(small);
            setIsSmallWidth(small);
        };

        setSidebarCollapse(mq.matches);
        setIsSmallWidth(mq.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const tabBtn = (id: SidebarMode, icon: React.ReactNode, label: string, fullWidth = false) => {
        const isActive = sidebarMode === id;
        return (
            <button
                key={id}
                className={`${fullWidth ? 'col-span-2' : ''} py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all border ${isActive ? 'border-primary text-primary bg-(--color-bg-active)' : 'border-(--color-border) text-(--color-text-muted) hover:bg-(--color-bg-hover)'}`}
                onClick={() => setSidebarMode(id)}
                title={label}
            >
                {icon}
                {label}
            </button>
        );
    };

    return (
        <div className={`${sidebarCollapse ? 'hidden' : 'w-52'} shrink-0 border-r border-(--color-border) bg-(--color-bg-panel) flex flex-col overflow-hidden`}>
            {/* Tab Grid: Row 1 = Bookmarks (full width), Row 2 = Tools + Pages */}
            <div className="grid grid-cols-2 gap-1.5 px-3 py-3 shrink-0">
                {tabBtn('bookmarks', <Bookmark size={14} />, 'Bookmarks', true)}
                {tabBtn('tools', <Layers size={14} />, 'Tools')}
                {tabBtn('thumbnails', <Grid2X2 size={14} />, 'Pages')}
            </div>

            <div className="mx-3 h-px bg-(--color-border)"></div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
                {sidebarMode === 'tools' && <ToolsPanel isSmallWidth={isSmallWidth} />}
                {sidebarMode === 'thumbnails' && <PagesPanel activePageIndex={activePageIndex} onPageSelect={onPageSelect} />}
                {sidebarMode === 'bookmarks' && <BookmarksPanel activePageIndex={activePageIndex} onPageSelect={onPageSelect} />}
            </div>
        </div>
    );
}
