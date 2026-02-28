import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Paper, Alert, CircularProgress,
  Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { Add, Edit, Delete, SwapHoriz } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { transferSchema, type TransferFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { transferApi } from '@/api/transfers';
import { accountApi } from '@/api/accounts';
import { formatCurrency, formatDate, getToday } from '@/utils/format';
import { useUndoStore } from '@/stores/undoStore';
import type { TransferResponse } from '@/types';
import { UNDO_TIMEOUT_MS } from '@/constants';

export default function TransferListPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransferResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const { pendingUndo, setPendingUndo, clearUndo } = useUndoStore();
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => transferApi.list({ size: 100 }),
    select: (res) => res.data.data,
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
    select: (res) => res.data.filter((a) => !a.deleted_at),
  });

  const form = useForm<TransferFormData>({
    resolver: zodFormResolver(transferSchema),
    defaultValues: { from_account_id: '', to_account_id: '', amount: undefined as unknown as number, date: getToday(), memo: '', currency: 'JPY' },
  });

  const openCreate = () => { setEditing(null); form.reset({ from_account_id: '', to_account_id: '', amount: undefined as unknown as number, date: getToday(), memo: '', currency: 'JPY' }); setDialogOpen(true); };
  const openEdit = (t: TransferResponse) => {
    setEditing(t);
    form.reset({ from_account_id: t.from_account_id, to_account_id: t.to_account_id, amount: t.amount, date: t.date, memo: t.memo || '', currency: t.currency });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: TransferFormData) => transferApi.create({ ...data, memo: data.memo || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transfers'] }); queryClient.invalidateQueries({ queryKey: ['accounts'] }); setDialogOpen(false); },
    onError: () => setError('振替の作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TransferFormData) => transferApi.update(editing!.id, { ...data, memo: data.memo || undefined, version: editing!.version }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transfers'] }); queryClient.invalidateQueries({ queryKey: ['accounts'] }); setDialogOpen(false); },
    onError: () => setError('振替の更新に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (t: TransferResponse) => transferApi.delete(t.id, t.version),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transfers'] }); queryClient.invalidateQueries({ queryKey: ['accounts'] }); },
    onError: () => setError('振替の削除に失敗しました'),
  });

  const handleDelete = (t: TransferResponse) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    deleteMutation.mutate(t);
    setPendingUndo({ type: 'transfer', data: t, deletedAt: Date.now() });
    setSnackOpen(true);
    undoTimerRef.current = setTimeout(() => { clearUndo(); setSnackOpen(false); }, UNDO_TIMEOUT_MS);
  };

  const handleUndo = async () => {
    if (!pendingUndo || pendingUndo.type !== 'transfer') return;
    const t = pendingUndo.data as TransferResponse;
    try {
      await transferApi.restore(t.id);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    } catch {
      // Notify user by refreshing list to show the item hasn't been restored
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    }
    clearUndo();
    setSnackOpen(false);
  };

  const onSubmit = (data: TransferFormData) => { setError(null); editing ? updateMutation.mutate(data) : createMutation.mutate(data); };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>振替一覧</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>新規振替</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>日付</TableCell>
              <TableCell>出金元</TableCell>
              <TableCell align="center"><SwapHoriz /></TableCell>
              <TableCell>入金先</TableCell>
              <TableCell>メモ</TableCell>
              <TableCell align="right">金額</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
            ) : transfers?.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary">振替がありません</Typography></TableCell></TableRow>
            ) : transfers?.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{formatDate(t.date)}</TableCell>
                <TableCell>{t.from_account?.name || '-'}</TableCell>
                <TableCell align="center">→</TableCell>
                <TableCell>{t.to_account?.name || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.memo || '-'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(t.amount)}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(t)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(t)}><Delete fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '振替の編集' : '新規振替'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="transfer-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <Controller name="from_account_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth error={!!form.formState.errors.from_account_id}>
                  <InputLabel>出金元</InputLabel>
                  <Select {...field} label="出金元">{accounts?.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</Select>
                </FormControl>
              )} />
              <Controller name="to_account_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth error={!!form.formState.errors.to_account_id}>
                  <InputLabel>入金先</InputLabel>
                  <Select {...field} label="入金先">{accounts?.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</Select>
                  {form.formState.errors.to_account_id && <Typography variant="caption" color="error">{form.formState.errors.to_account_id.message}</Typography>}
                </FormControl>
              )} />
              <TextField fullWidth label="金額" type="number" inputProps={{ step: 1, min: 1 }} {...form.register('amount', { valueAsNumber: true })} error={!!form.formState.errors.amount} helperText={form.formState.errors.amount?.message} />
              <TextField fullWidth label="日付" type="date" InputLabelProps={{ shrink: true }} {...form.register('date')} error={!!form.formState.errors.date} helperText={form.formState.errors.date?.message} />
              <TextField fullWidth label="メモ（任意）" {...form.register('memo')} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="transfer-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        message="振替を削除しました"
        action={
          <Button color="primary" size="small" onClick={handleUndo}>
            元に戻す
          </Button>
        }
      />
    </Box>
  );
}
