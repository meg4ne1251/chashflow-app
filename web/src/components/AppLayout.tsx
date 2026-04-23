import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthSync } from '@/hooks/useAuthSync';
import Sidebar from './shell/Sidebar';
import Topbar from './shell/Topbar';
import BottomTabs from './shell/BottomTabs';
import MobileDrawer from './shell/MobileDrawer';
import FAB from './shell/FAB';
import CommandPalette from './shell/CommandPalette';
import { resolvePageMeta } from './shell/navConfig';
import { useNavigate } from 'react-router-dom';
import './shell/app-layout.css';

export default function AppLayout() {
  useAuthSync();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const meta = resolvePageMeta(location.pathname);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Global ⌘K / Ctrl+K → open command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((c) => !c);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell-app">
      {/* Skip link */}
      <a href="#main-content" className="shell-skip-link">
        メインコンテンツへスキップ
      </a>

      <Sidebar onOpenCommand={() => setCmdOpen(true)} />

      <div className="shell-main">
        <Topbar
          title={meta.title}
          sub={meta.sub}
          onOpenCommand={() => setCmdOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        <main
          id="main-content"
          role="main"
          aria-label="メインコンテンツ"
          tabIndex={-1}
          className="shell-content"
        >
          <Outlet />
        </main>
      </div>

      <FAB />
      <BottomTabs onOpenForm={() => navigate('/transactions/new')} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
