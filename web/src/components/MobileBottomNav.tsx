import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Fab,
  Box,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Receipt as ReceiptIcon,
  Add as AddIcon,
  BarChart as BarChartIcon,
  MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';

const TAB_ROUTES = ['/dashboard', '/transactions', '/transactions/new', '/analysis', '/more'];

function routeToTab(pathname: string): number {
  if (pathname === '/dashboard') return 0;
  if (pathname.startsWith('/transactions')) return 1;
  if (pathname === '/analysis') return 3;
  if (pathname === '/more') return 4;
  // Pages accessible from "More" menu
  if (['/transfers', '/categories', '/accounts', '/tags', '/templates', '/recurring', '/budgets', '/settings', '/notifications'].includes(pathname)) return 4;
  return 0;
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentTab = routeToTab(location.pathname);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    navigate(TAB_ROUTES[newValue]);
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (t) => t.zIndex.appBar,
        pb: 'env(safe-area-inset-bottom)',
      }}
      elevation={8}
    >
      <Box sx={{ position: 'relative' }}>
        {/* Center FAB */}
        <Fab
          color="primary"
          size="medium"
          onClick={() => navigate('/transactions/new')}
          sx={{
            position: 'absolute',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
          }}
        >
          <AddIcon />
        </Fab>

        <BottomNavigation
          value={currentTab}
          onChange={handleChange}
          showLabels
          sx={{
            height: 56,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              py: 0.5,
            },
          }}
        >
          <BottomNavigationAction label="ホーム" icon={<DashboardIcon />} />
          <BottomNavigationAction label="取引" icon={<ReceiptIcon />} />
          {/* Spacer for center FAB */}
          <BottomNavigationAction
            label=""
            icon={<Box sx={{ width: 24, height: 24 }} />}
            sx={{ opacity: 0, pointerEvents: 'none' }}
          />
          <BottomNavigationAction label="分析" icon={<BarChartIcon />} />
          <BottomNavigationAction label="その他" icon={<MoreHorizIcon />} />
        </BottomNavigation>
      </Box>
    </Paper>
  );
}

export const MOBILE_BOTTOM_NAV_HEIGHT = 56;
