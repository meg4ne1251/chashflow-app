import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Receipt as ReceiptIcon,
  SwapHoriz as SwapHorizIcon,
  Category as CategoryIcon,
  AccountBalance as AccountBalanceIcon,
  Label as LabelIcon,
  BookmarkBorder as TemplateIcon,
  Repeat as RepeatIcon,
  BarChart as BarChartIcon,
  Savings as SavingsIcon,
  SavingsOutlined as SavingsGoalIcon,
  Settings as SettingsIcon,
  Brightness4,
  Brightness7,
  BrightnessAuto,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useMobile } from '@/hooks/useMobile';
import { useAuthSync } from '@/hooks/useAuthSync';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { ThemeMode } from '@/types';
import NotificationBell from './NotificationBell';
import MobileBottomNav from './MobileBottomNav';
import { SIDEBAR_WIDTH, MOBILE_BOTTOM_NAV_HEIGHT } from '@/constants';

const DRAWER_WIDTH = SIDEBAR_WIDTH;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { label: 'ダッシュボード', path: '/dashboard', icon: <DashboardIcon /> },
  { label: '取引一覧', path: '/transactions', icon: <ReceiptIcon /> },
  { label: '振替', path: '/transfers', icon: <SwapHorizIcon /> },
];

const masterNavItems: NavItem[] = [
  { label: 'カテゴリ', path: '/categories', icon: <CategoryIcon /> },
  { label: '決済手段', path: '/accounts', icon: <AccountBalanceIcon /> },
  { label: 'タグ', path: '/tags', icon: <LabelIcon /> },
  { label: 'テンプレート', path: '/templates', icon: <TemplateIcon /> },
  { label: '定期取引', path: '/recurring', icon: <RepeatIcon /> },
];

const analysisNavItems: NavItem[] = [
  { label: '分析', path: '/analysis', icon: <BarChartIcon /> },
  { label: '予算', path: '/budgets', icon: <SavingsIcon /> },
  { label: '貯蓄目標', path: '/savings-goals', icon: <SavingsGoalIcon /> },
];

const settingsNavItems: NavItem[] = [
  { label: '設定', path: '/settings', icon: <SettingsIcon /> },
];

export default function AppLayout() {
  useAuthSync();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMobile();

  const { sidebarOpen, setSidebarOpen, toggleSidebar, themeMode, setThemeMode } = useUiStore();
  const { logout, username } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const allNavItems = useMemo(() => [
    ...mainNavItems,
    ...masterNavItems,
    ...analysisNavItems,
    ...settingsNavItems,
    { label: '通知履歴', path: '/notifications', icon: null },
    { label: 'その他', path: '/more', icon: null },
  ], []);

  const pageTitle = useMemo(() => {
    if (location.pathname === '/transactions/new') return '新規取引';
    if (location.pathname.match(/^\/transactions\/[^/]+\/edit$/)) return '取引の編集';
    return allNavItems.find((i) => i.path === location.pathname)?.label ?? '家計簿';
  }, [location.pathname, allNavItems]);

  const handleNavClick = (path: string) => {
    navigate(path);
  };

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

  const themeIcon = themeMode === 'dark' ? <Brightness7 /> : themeMode === 'light' ? <Brightness4 /> : <BrightnessAuto />;
  const themeModeLabel = themeMode === 'light' ? 'ライト' : themeMode === 'dark' ? 'ダーク' : 'システム';

  const renderNavSection = (items: NavItem[], label?: string) => (
    <>
      {label && (
        <Typography 
          variant="overline" 
          sx={{ px: 2, pt: 2, pb: 0.5, display: 'block', color: 'text.secondary' }}
          id={`nav-section-${label}`}
        >
          {label}
        </Typography>
      )}
      <List 
        disablePadding
        aria-labelledby={label ? `nav-section-${label}` : undefined}
      >
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              selected={isActive}
              onClick={() => handleNavClick(item.path)}
              sx={{ mx: 1, borderRadius: 1, mb: 0.5 }}
              aria-current={isActive ? 'page' : undefined}
            >
              <ListItemIcon sx={{ minWidth: 40 }} aria-hidden="true">{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </>
  );

  const drawerContent = (
    <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" noWrap fontWeight={700} color="primary">
          家計簿
        </Typography>
      </Toolbar>
      <Divider />
      {renderNavSection(mainNavItems)}
      <Divider sx={{ mx: 2, my: 1 }} />
      {renderNavSection(masterNavItems, 'マスタ管理')}
      <Divider sx={{ mx: 2, my: 1 }} />
      {renderNavSection(analysisNavItems, '分析')}
      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ mx: 2, my: 1 }} />
      {renderNavSection(settingsNavItems)}
    </Box>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* スキップリンク */}
        <Box
          component="a"
          href="#main-content"
          sx={{
            position: 'absolute',
            left: '-9999px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            zIndex: -999,
            '&:focus, &:active': {
              left: '8px',
              top: '8px',
              width: 'auto',
              height: 'auto',
              overflow: 'visible',
              zIndex: 9999,
              padding: '12px 24px',
              backgroundColor: 'primary.main',
              color: 'white',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 1,
              boxShadow: 2,
            },
          }}
        >
          メインコンテンツへスキップ
        </Box>

        <AppBar position="fixed" color="default" elevation={1}>
          <Toolbar>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }} fontWeight={700}>
              {pageTitle}
            </Typography>
            <IconButton 
              onClick={cycleTheme} 
              size="small" 
              title={`テーマ: ${themeMode}`}
              aria-label={`テーマを切り替え（現在: ${themeModeLabel}）`}
            >
              {themeIcon}
            </IconButton>
            <NotificationBell />
            <IconButton 
              onClick={(e) => setAnchorEl(e.currentTarget)} 
              size="small"
              aria-label="アカウントメニューを開く"
              aria-haspopup="true"
              aria-expanded={!!anchorEl}
            >
              <AccountCircle />
            </IconButton>
            <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>
                <Typography variant="body2">{username || 'ユーザー'}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                ログアウト
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          id="main-content"
          role="main"
          aria-label="メインコンテンツ"
          tabIndex={-1}
          sx={{
            flexGrow: 1,
            p: 2,
            pb: `${MOBILE_BOTTOM_NAV_HEIGHT + 16}px`,
            outline: 'none',
          }}
        >
          <Toolbar />
          <Outlet />
        </Box>

        <MobileBottomNav />
      </Box>
    );
  }

  // Desktop layout
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* スキップリンク */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: -999,
          '&:focus, &:active': {
            left: '8px',
            top: '8px',
            width: 'auto',
            height: 'auto',
            overflow: 'visible',
            zIndex: 9999,
            padding: '12px 24px',
            backgroundColor: 'primary.main',
            color: 'white',
            fontWeight: 600,
            textDecoration: 'none',
            borderRadius: 1,
            boxShadow: 2,
          },
        }}
      >
        メインコンテンツへスキップ
      </Box>

      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          ...(sidebarOpen && {
            width: `calc(100% - ${DRAWER_WIDTH}px)`,
            ml: `${DRAWER_WIDTH}px`,
          }),
        }}
        color="default"
        elevation={1}
      >
        <Toolbar>
          <IconButton 
            edge="start" 
            onClick={toggleSidebar} 
            sx={{ mr: 2 }}
            aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
            aria-expanded={sidebarOpen}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {pageTitle}
          </Typography>
          <IconButton 
            onClick={cycleTheme} 
            title={`テーマ: ${themeMode}`}
            aria-label={`テーマを切り替え（現在: ${themeModeLabel}）`}
          >
            {themeIcon}
          </IconButton>
          <NotificationBell />
          <IconButton 
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label="アカウントメニューを開く"
            aria-haspopup="true"
            aria-expanded={!!anchorEl}
          >
            <AccountCircle />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2">{username || 'ユーザー'}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              ログアウト
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        aria-label="メインナビゲーション"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        id="main-content"
        role="main"
        aria-label="メインコンテンツ"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          p: 3,
          transition: 'margin 0.3s',
          ml: sidebarOpen ? 0 : `-${DRAWER_WIDTH}px`,
          width: sidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          outline: 'none',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
