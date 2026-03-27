import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  EditNote as InputRemindIcon,
  WarningAmber as BudgetAlertIcon,
  CreditCard as CreditCardIcon,
  DoneAll as MarkAllReadIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { useMobile } from '@/hooks/useMobile';
import type { NotificationType } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';

dayjs.locale('ja');

const TYPE_LABELS: Record<NotificationType, string> = {
  input_remind: '入力リマインダー',
  budget_alert: '予算アラート',
  credit_card_payment: 'クレカ引落し',
};

export default function NotificationHistoryPage() {
  const isMobile = useMobile();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [readFilter, setReadFilter] = useState<string>('');

  const { notifications, pagination, isLoading, markAsRead, markAllAsRead } = useNotificationHistory({
    type: typeFilter || undefined,
    is_read: readFilter || undefined,
    page,
    size: DEFAULT_PAGE_SIZE,
  });

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent={isMobile ? 'flex-end' : 'space-between'} alignItems="center" mb={2}>
        {!isMobile && <Typography variant="h5" fontWeight={600}>通知履歴</Typography>}
        <Button
          startIcon={<MarkAllReadIcon />}
          onClick={() => markAllAsRead()}
          size="small"
        >
          すべて既読にする
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>種類</InputLabel>
          <Select
            value={typeFilter}
            label="種類"
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <MenuItem value="">すべて</MenuItem>
            <MenuItem value="input_remind">入力リマインダー</MenuItem>
            <MenuItem value="budget_alert">予算アラート</MenuItem>
            <MenuItem value="credit_card_payment">クレカ引落し</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>状態</InputLabel>
          <Select
            value={readFilter}
            label="状態"
            onChange={(e) => { setReadFilter(e.target.value); setPage(1); }}
          >
            <MenuItem value="">すべて</MenuItem>
            <MenuItem value="false">未読</MenuItem>
            <MenuItem value="true">既読</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">通知はありません</Typography>
        </Box>
      ) : (
        <>
          <List disablePadding>
            {notifications.map((n) => (
              <ListItem
                key={n.id}
                sx={{
                  bgcolor: n.is_read ? 'transparent' : 'action.hover',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: n.is_read ? 'default' : 'pointer',
                }}
                onClick={() => { if (!n.is_read) markAsRead(n.id); }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {n.type === 'input_remind' ? (
                    <InputRemindIcon color="primary" />
                  ) : n.type === 'credit_card_payment' ? (
                    <CreditCardIcon color="info" />
                  ) : (
                    <BudgetAlertIcon color="warning" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>{n.title}</Typography>
                      <Chip
                        label={TYPE_LABELS[n.type as NotificationType] ?? n.type}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                      {!n.is_read && (
                        <Chip label="未読" size="small" color="error" sx={{ fontSize: '0.7rem' }} />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.5}>
                      <Typography variant="body2" color="text.secondary">{n.message}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 2 }}>
                        {dayjs(n.created_at).format('YYYY/MM/DD HH:mm')}
                      </Typography>
                    </Stack>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            ))}
          </List>

          {pagination && pagination.total_pages != null && pagination.total_pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pagination.total_pages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
