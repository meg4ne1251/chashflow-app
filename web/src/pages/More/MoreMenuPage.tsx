import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Grid } from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Category as CategoryIcon,
  AccountBalance as AccountBalanceIcon,
  Label as LabelIcon,
  BookmarkBorder as TemplateIcon,
  Repeat as RepeatIcon,
  Savings as SavingsIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';

const menuItems = [
  { label: '振替', path: '/transfers', icon: <SwapHorizIcon />, color: '#1976d2' },
  { label: 'カテゴリ', path: '/categories', icon: <CategoryIcon />, color: '#9c27b0' },
  { label: '決済手段', path: '/accounts', icon: <AccountBalanceIcon />, color: '#2e7d32' },
  { label: 'タグ', path: '/tags', icon: <LabelIcon />, color: '#ed6c02' },
  { label: 'テンプレート', path: '/templates', icon: <TemplateIcon />, color: '#0288d1' },
  { label: '定期取引', path: '/recurring', icon: <RepeatIcon />, color: '#7b1fa2' },
  { label: '予算', path: '/budgets', icon: <SavingsIcon />, color: '#c62828' },
  { label: '設定', path: '/settings', icon: <SettingsIcon />, color: '#546e7a' },
  { label: '通知履歴', path: '/notifications', icon: <NotificationsIcon />, color: '#f57c00' },
];

export default function MoreMenuPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <Grid container spacing={1.5}>
        {menuItems.map((item) => (
          <Grid size={{ xs: 4 }} key={item.path}>
            <Paper
              onClick={() => navigate(item.path)}
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                borderRadius: 2,
                transition: 'background-color 0.15s',
                '&:active': { bgcolor: 'action.selected' },
              }}
              elevation={0}
              variant="outlined"
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: `${item.color}18`,
                  color: item.color,
                }}
              >
                {item.icon}
              </Box>
              <Typography variant="caption" textAlign="center" lineHeight={1.2}>
                {item.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
