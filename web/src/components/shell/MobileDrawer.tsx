import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import { NAV_MAIN, NAV_MASTER, NAV_ANALYSIS, NAV_SETTINGS, type NavItem } from './navConfig';
import './mobile-drawer.css';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

function Section({ items, label, onClose }: { items: NavItem[]; label?: string; onClose: () => void }) {
  return (
    <div>
      {label && <div className="shell-drawer-label">{label}</div>}
      {items.map((i) => (
        <NavLink
          key={i.path}
          to={i.path}
          onClick={onClose}
          className={({ isActive }) => 'shell-drawer-item' + (isActive ? ' active' : '')}
        >
          <Icon name={i.icon} size={16} />
          <span>{i.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="shell-drawer-overlay" onClick={onClose} />
      <aside className="shell-drawer" role="dialog" aria-label="ナビゲーション">
        <div className="shell-drawer-brand">
          <div className="shell-brand-mark">¥</div>
          <div className="shell-brand-meta">
            <div className="shell-brand-name">家計簿</div>
            <div className="shell-brand-sub">{dayjs().format('YYYY年M月')}</div>
          </div>
          <button
            type="button"
            className="shell-icon-btn"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
            aria-label="閉じる"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <Section items={NAV_MAIN} onClose={onClose} />
        <Section items={NAV_MASTER} label="マスタ管理" onClose={onClose} />
        <Section items={NAV_ANALYSIS} label="分析" onClose={onClose} />
        <Section items={NAV_SETTINGS} onClose={onClose} />
      </aside>
    </>
  );
}
