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
  useMediaQuery,
  useTheme,
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
  Settings as SettingsIcon,
  Brightness4,
  Brightness7,
  BrightnessAuto,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { ThemeMode } from '@/types';
import NotificationBell from './NotificationBell';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from './MobileBottomNav';

const DRAWER_WIDTH = 260;

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
];

const settingsNavItems: NavItem[] = [
  { label: '設定', path: '/settings', icon: <SettingsIcon /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { sidebarOpen, setSidebarOpen, toggleSidebar, themeMode, setThemeMode } = useUiStore();
  const { logout, username } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const allNavItems = [
    ...mainNavItems, ...masterNavItems, ...analysisNavItems, ...settingsNavItems,
    { label: 'その他', path: '/more', icon: null },
  ];

  const pageTitle = useMemo(
    () => allNavItems.find((i) => i.path === location.pathname)?.label ?? '家計簿',
    [allNavItems, location.pathname]
  );

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

  const renderNavSection = (items: NavItem[], label?: string) => (
    <>
      {label && (
        <Typography variant="overline" sx={{ px: 2, pt: 2, pb: 0.5, display: 'block', color: 'text.secondary' }}>
          {label}
        </Typography>
      )}
      <List disablePadding>
        {items.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => handleNavClick(item.path)}
            sx={{ mx: 1, borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
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
        <AppBar position="fixed" color="default" elevation={1}>
          <Toolbar>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }} fontWeight={700}>
              {pageTitle}
            </Typography>
            <IconButton onClick={cycleTheme} size="small" title={`テーマ: ${themeMode}`}>
              {themeIcon}
            </IconButton>
            <NotificationBell />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
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
          sx={{
            flexGrow: 1,
            p: 2,
            pb: `${MOBILE_BOTTOM_NAV_HEIGHT + 16}px`,
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
          <IconButton edge="start" onClick={toggleSidebar} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {pageTitle}
          </Typography>
          <IconButton onClick={cycleTheme} title={`テーマ: ${themeMode}`}>
            {themeIcon}
          </IconButton>
          <NotificationBell />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
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
        sx={{
          flexGrow: 1,
          p: 3,
          transition: 'margin 0.3s',
          ml: sidebarOpen ? 0 : `-${DRAWER_WIDTH}px`,
          width: sidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
