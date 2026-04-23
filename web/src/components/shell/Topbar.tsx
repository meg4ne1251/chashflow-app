import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, MenuItem, ListItemIcon, Divider, Typography } from '@mui/material';
import { Icon } from '@/components/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { ThemeMode } from '@/types';
import NotificationBell from '@/components/NotificationBell';
import './topbar.css';

interface TopbarProps {
  title: string;
  sub?: string;
  onOpenCommand: () => void;
  onOpenDrawer: () => void;
}

export default function Topbar({ title, sub, onOpenCommand, onOpenDrawer }: TopbarProps) {
  const navigate = useNavigate();
  const { themeMode, setThemeMode } = useUiStore();
  const { logout, username } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  };

  const cycleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const idx = modes.indexOf(themeMode);
    setThemeMode(modes[(idx + 1) % modes.length]);
  };

  const themeIconName = themeMode === 'dark' ? 'moon' : themeMode === 'light' ? 'sun' : 'auto';
  const themeLabel = themeMode === 'light' ? 'ライト' : themeMode === 'dark' ? 'ダーク' : 'システム';

  const initial = (username || 'U').charAt(0).toUpperCase();

  return (
    <header className="shell-topbar">
      <button
        type="button"
        className="shell-icon-btn shell-topbar-mobile-menu"
        onClick={onOpenDrawer}
        aria-label="メニューを開く"
      >
        <Icon name="menu" size={18} />
      </button>

      <div className="shell-crumb">
        <b>{title}</b>
        {sub && (
          <>
            {' · '}
            <span>{sub}</span>
          </>
        )}
      </div>

      <div className="shell-topbar-spacer" />

      <button
        type="button"
        className="shell-searchbar"
        onClick={onOpenCommand}
        aria-label="クイック検索を開く"
      >
        <Icon name="search" size={14} />
        <span className="shell-searchbar-label">取引・カテゴリを検索</span>
        <span className="shell-searchbar-kbd">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </button>

      <button
        type="button"
        className="shell-icon-btn"
        onClick={cycleTheme}
        title={`テーマ: ${themeLabel}`}
        aria-label={`テーマを切り替え（現在: ${themeLabel}）`}
      >
        <Icon name={themeIconName} size={16} />
      </button>

      <NotificationBell />

      <button
        type="button"
        className="shell-icon-btn shell-topbar-settings"
        onClick={() => navigate('/settings')}
        aria-label="設定"
      >
        <Icon name="settings" size={16} />
      </button>

      <button
        type="button"
        className="shell-avatar"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="アカウントメニューを開く"
        aria-haspopup="true"
        aria-expanded={!!anchorEl}
      >
        {initial}
      </button>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <Typography variant="body2">{username || 'ユーザー'}</Typography>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/settings');
          }}
        >
          <ListItemIcon>
            <Icon name="settings" size={16} />
          </ListItemIcon>
          設定
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Icon name="logout" size={16} />
          </ListItemIcon>
          ログアウト
        </MenuItem>
      </Menu>
    </header>
  );
}
