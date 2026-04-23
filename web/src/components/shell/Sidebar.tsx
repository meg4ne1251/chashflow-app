import { NavLink } from 'react-router-dom';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import { NAV_MAIN, NAV_MASTER, NAV_ANALYSIS, NAV_SETTINGS, type NavItem } from './navConfig';
import './sidebar.css';

interface SidebarProps {
  onOpenCommand: () => void;
}

function Item({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => 'shell-nav-item' + (isActive ? ' active' : '')}
    >
      <Icon name={item.icon} size={16} className="ico" />
      <span className="shell-nav-label">{item.label}</span>
      {item.badge && <span className="shell-nav-badge">{item.badge}</span>}
    </NavLink>
  );
}

export default function Sidebar({ onOpenCommand }: SidebarProps) {
  return (
    <aside className="shell-sidebar">
      <div className="shell-brand">
        <div className="shell-brand-mark">¥</div>
        <div className="shell-brand-meta">
          <div className="shell-brand-name">家計簿</div>
          <div className="shell-brand-sub">{dayjs().format('YYYY年M月')}</div>
        </div>
      </div>

      <div className="shell-nav-section">
        {NAV_MAIN.map((i) => <Item key={i.path} item={i} />)}
      </div>

      <div className="shell-nav-section">
        <div className="shell-nav-section-label">マスタ管理</div>
        {NAV_MASTER.map((i) => <Item key={i.path} item={i} />)}
      </div>

      <div className="shell-nav-section">
        <div className="shell-nav-section-label">分析</div>
        {NAV_ANALYSIS.map((i) => <Item key={i.path} item={i} />)}
      </div>

      <div style={{ flex: 1 }} />

      <div className="shell-nav-section">
        {NAV_SETTINGS.map((i) => <Item key={i.path} item={i} />)}
      </div>

      <button type="button" className="shell-cmd-hint" onClick={onOpenCommand}>
        <Icon name="command" size={14} />
        <span className="shell-cmd-hint-label">クイック検索</span>
        <span className="shell-cmd-hint-kbd">
          <span className="kbd">⌘</span> <span className="kbd">K</span>
        </span>
      </button>
    </aside>
  );
}
