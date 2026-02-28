import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography, Paper, Alert, FormControl,
  InputLabel, Select, MenuItem, Stack, CircularProgress, Chip,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountSchema, type AccountFormData } from '@/validation/schemas';
import { accountApi } from '@/api/accounts';
import { accountTypeLabels, formatCurrency } from '@/utils/format';
import type { AccountResponse } from '@/types';

export default function AccountListPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountResponse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
    select: (res) => res.data.filter((a) => !a.deleted_at),
  });

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema) as never,
    defaultValues: { name: '', type: 'cash', initial_balance: 0, currency: 'JPY', sort_order: 0 },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', type: 'cash', initial_balance: 0, currency: 'JPY', sort_order: 0 });
    setDialogOpen(true);
  };

  const openEdit = (a: AccountResponse) => {
    setEditing(a);
    form.reset({ name: a.name, type: a.type, initial_balance: a.initial_balance, currency: a.currency, sort_order: a.sort_order });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: AccountFormData) => accountApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); setDialogOpen(false); },
    onError: () => setError('アカウントの作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: AccountFormData) => accountApi.update(editing!.id, { ...data, version: editing!.version }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); setDialogOpen(false); },
    onError: () => setError('アカウントの更新に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (a: AccountResponse) => accountApi.delete(a.id, a.version),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); setDeleteConfirm(null); },
    onError: () => setError('アカウントの削除に失敗しました'),
  });

  const onSubmit = (data: AccountFormData) => {
    setError(null);
    editing ? updateMutation.mutate(data) : createMutation.mutate(data);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>アカウント管理</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>追加</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>名前</TableCell>
              <TableCell>種別</TableCell>
              <TableCell align="right">初期残高</TableCell>
              <TableCell align="right">現在の残高</TableCell>
              <TableCell>表示順</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
            ) : accounts?.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>{a.name}</TableCell>
                <TableCell><Chip size="small" label={accountTypeLabels[a.type] || a.type} variant="outlined" /></TableCell>
                <TableCell align="right">{formatCurrency(a.initial_balance)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: a.balance >= 0 ? 'success.main' : 'error.main' }}>
                  {formatCurrency(a.balance)}
                </TableCell>
                <TableCell>{a.sort_order}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(a)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteConfirm(a)}><Delete fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'アカウントの編集' : 'アカウントの追加'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="account-form" onSubmit={form.handleSubmit(onSubmit as never)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField fullWidth label="アカウント名" {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} />
              <Controller name="type" control={form.control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>種別</InputLabel>
                  <Select {...field} label="種別">
                    {Object.entries(accountTypeLabels).map(([k, v]) => (
                      <MenuItem key={k} value={k}>{v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )} />
              <TextField fullWidth label="初期残高" type="number" inputProps={{ step: 1 }}
                {...form.register('initial_balance', { valueAsNumber: true })}
                error={!!form.formState.errors.initial_balance}
                helperText={form.formState.errors.initial_balance?.message} />
              <TextField fullWidth label="表示順" type="number" {...form.register('sort_order', { valueAsNumber: true })} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="account-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>アカウントの削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{deleteConfirm?.name}」を削除しますか？
            削除後も過去の取引データは保持されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>削除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
