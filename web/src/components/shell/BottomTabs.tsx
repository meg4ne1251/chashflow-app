import { useNavigate, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import './bottom-tabs.css';

interface BottomTabsProps {
  onOpenForm: () => void;
}

interface TabDef {
  id: string;
  label: string;
  icon: IconName;
  path?: string;
  action?: 'add';
  big?: boolean;
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'ホーム', icon: 'dashboard', path: '/dashboard' },
  { id: 'transactions', label: '取引', icon: 'list', path: '/transactions' },
  { id: 'add', label: '追加', icon: 'plus', action: 'add', big: true },
  { id: 'analysis', label: '分析', icon: 'chart', path: '/analysis' },
  { id: 'more', label: 'メニュー', icon: 'menu', path: '/more' },
];

const MORE_PATHS = new Set([
  '/transfers',
  '/categories',
  '/accounts',
  '/tags',
  '/templates',
  '/recurring',
  '/budgets',
  '/savings-goals',
  '/settings',
  '/notifications',
  '/more',
]);

function activeTabId(pathname: string): string {
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/transactions')) return 'transactions';
  if (pathname === '/analysis') return 'analysis';
  if (MORE_PATHS.has(pathname)) return 'more';
  return 'dashboard';
}

export default function BottomTabs({ onOpenForm }: BottomTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = activeTabId(location.pathname);

  return (
    <nav className="shell-bottom-tabs" aria-label="メインナビゲーション">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={'shell-bottom-tab' + (active === t.id ? ' active' : '')}
          onClick={() => {
            if (t.action === 'add') onOpenForm();
            else if (t.path) navigate(t.path);
          }}
          aria-current={active === t.id ? 'page' : undefined}
        >
          {t.big ? (
            <div className="shell-bottom-tab-big">
              <Icon name={t.icon} size={20} stroke={2.4} />
            </div>
          ) : (
            <Icon name={t.icon} size={20} />
          )}
          {!t.big && <span className="shell-bottom-tab-lbl">{t.label}</span>}
        </button>
      ))}
    </nav>
  );
}
