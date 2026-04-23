import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Paper, Alert, CircularProgress,
  Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, FormControl, InputLabel, Select, MenuItem,
  Chip, Switch, FormControlLabel,
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import { useMobile } from '@/hooks/useMobile';
import { Icon as UiIcon } from '@/components/Icon';
import { useForm, Controller } from 'react-hook-form';
import { recurringTransactionSchema, type RecurringTransactionFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { recurringTransactionApi } from '@/api/recurringTransactions';
import { categoryApi } from '@/api/categories';
import { accountApi } from '@/api/accounts';
import { formatCurrency, formatDate, frequencyLabels, dayOfWeekLabels } from '@/utils/format';
import { EMPTY_NUMBER } from '@/constants';
import type { RecurringTransactionResponse } from '@/types';

export default function RecurringTransactionListPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RecurringTransactionResponse | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['recurringTransactions'],
    queryFn: () => recurringTransactionApi.list(),
    select: (res) => res.data,
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list(), select: (r) => r.data.filter((c) => !c.deleted_at) });
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list(), select: (r) => r.data.filter((a) => !a.deleted_at) });

  const form = useForm<RecurringTransactionFormData>({
    resolver: zodFormResolver(recurringTransactionSchema),
    defaultValues: { name: '', type: 'expense', amount: EMPTY_NUMBER, category_id: '', account_id: '', memo: '', frequency: 'monthly', interval: 1, day_of_month: 1, day_of_week: undefined, start_date: '', end_date: '', is_active: true },
  });

  const watchType = form.watch('type');
  const watchFreq = form.watch('frequency');
  const filteredCategories = categories?.filter((c) => c.type === watchType);

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', type: 'expense', amount: EMPTY_NUMBER, category_id: '', account_id: '', memo: '', frequency: 'monthly', interval: 1, day_of_month: 1, day_of_week: undefined, start_date: '', end_date: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (r: RecurringTransactionResponse) => {
    setEditing(r);
    form.reset({
      name: r.name || '', type: r.type, amount: r.amount, category_id: r.category_id, account_id: r.account_id, memo: r.memo || '',
      frequency: r.frequency, interval: r.interval ?? 1, day_of_month: r.day_of_month ?? 1, day_of_week: r.day_of_week ?? undefined,
      start_date: r.start_date, end_date: r.end_date || '', is_active: r.is_active,
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: RecurringTransactionFormData) => recurringTransactionApi.create({
      ...data, name: data.name || undefined, memo: data.memo || undefined, end_date: data.end_date || undefined,
      day_of_week: data.frequency === 'weekly' ? (data.day_of_week ?? undefined) : undefined,
      day_of_month: data.frequency !== 'weekly' ? (data.day_of_month ?? undefined) : undefined,
      month_of_year: undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] }); setDialogOpen(false); setSnackMsg('定期取引を作成しました'); },
    onError: () => setError('定期取引の作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: RecurringTransactionFormData) => recurringTransactionApi.update(editing!.id, {
      ...data, name: data.name || undefined, memo: data.memo || undefined, end_date: data.end_date || undefined, version: editing!.version,
      day_of_week: data.frequency === 'weekly' ? (data.day_of_week ?? undefined) : undefined,
      day_of_month: data.frequency !== 'weekly' ? (data.day_of_month ?? undefined) : undefined,
      month_of_year: undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] }); setDialogOpen(false); setSnackMsg('定期取引を更新しました'); },
    onError: () => setError('定期取引の更新に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (r: RecurringTransactionResponse) => recurringTransactionApi.delete(r.id, r.version),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] }); setSnackMsg('定期取引を削除しました'); },
    onError: () => setError('定期取引の削除に失敗しました'),
  });

  const toggleMutation = useMutation({
    mutationFn: (r: RecurringTransactionResponse) => recurringTransactionApi.toggle(r.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] }),
  });

  const onSubmit = (data: RecurringTransactionFormData) => { setError(null); editing ? updateMutation.mutate(data) : createMutation.mutate(data); };

  const getCategoryName = (id: string) => categories?.find((c) => c.id === id)?.name || '-';
  const getAccountName = (id: string) => accounts?.find((a) => a.id === id)?.name || '-';

  const freqLabel = (r: RecurringTransactionResponse) => {
    if (r.frequency === 'weekly') return `${frequencyLabels[r.frequency]}（${r.day_of_week != null ? dayOfWeekLabels[r.day_of_week] : '-'}）`;
    if (r.frequency === 'monthly') return `${frequencyLabels[r.frequency]}（${r.day_of_month ?? '-'}日）`;
    if (r.frequency === 'yearly') return `${frequencyLabels[r.frequency]}（${r.day_of_month ?? '-'}日）`;
    return frequencyLabels[r.frequency] || r.frequency;
  };

  return (
    <Box>
      <div className="page-h">
        <div>
          <h1>定期取引</h1>
          <div className="sub">
            {items?.length ?? 0} 件 · 自動で記録される取引ルール
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <UiIcon name="plus" size={14} stroke={2.4} /> 定期取引追加
          </button>
        </div>
      </div>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {isMobile ? (
        isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : items?.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>定期取引がありません</Typography>
        ) : (
          <Stack spacing={1}>
            {items?.map((r) => (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.5, cursor: 'pointer', opacity: r.is_active ? 1 : 0.5, '&:active': { bgcolor: 'action.selected' } }} onClick={() => openEdit(r)}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>{r.name || getCategoryName(r.category_id)}</Typography>
                      <Chip size="small" label={r.type === 'income' ? '収入' : '支出'} color={r.type === 'income' ? 'success' : 'error'} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {freqLabel(r)} / 次回: {r.next_execution_date ? formatDate(r.next_execution_date) : '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: r.type === 'income' ? 'success.main' : 'error.main' }}>
                      {formatCurrency(r.amount)}
                    </Typography>
                    <Switch checked={r.is_active} size="small" onClick={(e) => e.stopPropagation()} onChange={() => toggleMutation.mutate(r)} />
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>種別</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>カテゴリ</TableCell>
                <TableCell>決済手段</TableCell>
                <TableCell>頻度</TableCell>
                <TableCell>メモ</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell align="center">有効</TableCell>
                <TableCell>次回実行</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} align="center"><CircularProgress /></TableCell></TableRow>
              ) : items?.length === 0 ? (
                <TableRow><TableCell colSpan={10} align="center"><Typography color="text.secondary">定期取引がありません</Typography></TableCell></TableRow>
              ) : items?.map((r) => (
                <TableRow key={r.id} hover sx={{ opacity: r.is_active ? 1 : 0.5 }}>
                  <TableCell><Chip label={r.type === 'income' ? '収入' : '支出'} color={r.type === 'income' ? 'success' : 'error'} size="small" /></TableCell>
                  <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '-'}</TableCell>
                  <TableCell>{getCategoryName(r.category_id)}</TableCell>
                  <TableCell>{getAccountName(r.account_id)}</TableCell>
                  <TableCell>{freqLabel(r)}</TableCell>
                  <TableCell sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.memo || '-'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: r.type === 'income' ? 'success.main' : 'error.main' }}>{formatCurrency(r.amount)}</TableCell>
                  <TableCell align="center"><Switch checked={r.is_active} size="small" onChange={() => toggleMutation.mutate(r)} /></TableCell>
                  <TableCell>{r.next_execution_date ? formatDate(r.next_execution_date) : '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(r)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? '定期取引の編集' : '新規定期取引'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="recurring-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField fullWidth label="名前（任意）" {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} />
              <Controller name="type" control={form.control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>種別</InputLabel>
                  <Select {...field} label="種別" onChange={(e) => { field.onChange(e); form.setValue('category_id', ''); }}>
                    <MenuItem value="expense">支出</MenuItem>
                    <MenuItem value="income">収入</MenuItem>
                  </Select>
                </FormControl>
              )} />
              <TextField fullWidth label="金額" type="number" inputProps={{ step: 1, min: 1 }} {...form.register('amount', { valueAsNumber: true })} error={!!form.formState.errors.amount} helperText={form.formState.errors.amount?.message} />
              <Controller name="category_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth error={!!form.formState.errors.category_id}>
                  <InputLabel>カテゴリ</InputLabel>
                  <Select {...field} label="カテゴリ">{filteredCategories?.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select>
                </FormControl>
              )} />
              <Controller name="account_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth error={!!form.formState.errors.account_id}>
                  <InputLabel>決済手段</InputLabel>
                  <Select {...field} label="決済手段">{accounts?.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</Select>
                </FormControl>
              )} />
              <Controller name="frequency" control={form.control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>頻度</InputLabel>
                  <Select {...field} label="頻度">
                    <MenuItem value="daily">毎日</MenuItem>
                    <MenuItem value="weekly">毎週</MenuItem>
                    <MenuItem value="monthly">毎月</MenuItem>
                    <MenuItem value="yearly">毎年</MenuItem>
                  </Select>
                </FormControl>
              )} />
              {watchFreq === 'weekly' && (
                <Controller name="day_of_week" control={form.control} render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>曜日</InputLabel>
                    <Select {...field} label="曜日" value={field.value ?? ''}>
                      {Object.entries(dayOfWeekLabels).map(([k, v]) => <MenuItem key={k} value={Number(k)}>{v}</MenuItem>)}
                    </Select>
                  </FormControl>
                )} />
              )}
              {watchFreq !== 'weekly' && watchFreq !== 'daily' && (
                <TextField fullWidth label="日（何日）" type="number" inputProps={{ min: 1, max: 31 }} {...form.register('day_of_month', { valueAsNumber: true })} error={!!form.formState.errors.day_of_month} />
              )}
              <TextField fullWidth label="開始日" type="date" InputLabelProps={{ shrink: true }} {...form.register('start_date')} error={!!form.formState.errors.start_date} />
              <TextField fullWidth label="終了日（任意）" type="date" InputLabelProps={{ shrink: true }} {...form.register('end_date')} />
              <TextField fullWidth label="メモ（任意）" {...form.register('memo')} />
              <Controller name="is_active" control={form.control} render={({ field }) => (
                <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="有効" />
              )} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="recurring-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>定期取引の削除</DialogTitle>
        <DialogContent>
          <Typography>この定期取引を削除しますか？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={() => { if (deleteConfirm) { deleteMutation.mutate(deleteConfirm); setDeleteConfirm(null); } }}>削除</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackMsg} autoHideDuration={3000} onClose={() => setSnackMsg(null)} message={snackMsg} sx={isMobile ? { bottom: 72 } : undefined} />
    </Box>
  );
}
