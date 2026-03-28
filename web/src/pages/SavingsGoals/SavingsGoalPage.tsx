import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Grid, Card, CardContent, TextField,
  LinearProgress, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Stack, FormControl, InputLabel, Select,
  MenuItem, Alert, CircularProgress, Snackbar, Chip, Icon,
} from '@mui/material';
import { Add, Edit, Delete, SavingsOutlined, EmojiEvents } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { savingsGoalSchema, savingsDepositSchema, type SavingsGoalFormData, type SavingsDepositFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { savingsGoalApi } from '@/api/savingsGoals';
import { accountApi } from '@/api/accounts';
import { formatCurrency } from '@/utils/format';
import { EMPTY_NUMBER } from '@/constants';
import type { SavingsGoalResponse } from '@/types';
import { useMobile } from '@/hooks/useMobile';
import IconPicker from '@/components/IconPicker';

export default function SavingsGoalPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoalResponse | null>(null);
  const [depositDialog, setDepositDialog] = useState<SavingsGoalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SavingsGoalResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'achieved'>('all');

  const { data: goals, isLoading } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => savingsGoalApi.list(),
    select: (r) => r.data,
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
    select: (r) => r.data.filter((a) => !a.deleted_at && a.type !== 'savings'),
  });

  const form = useForm<SavingsGoalFormData>({
    resolver: zodFormResolver(savingsGoalSchema),
    defaultValues: {
      name: '', target_amount: EMPTY_NUMBER,
      deadline: '', icon: '', color: '', sort_order: 0,
    },
  });

  const depositForm = useForm<SavingsDepositFormData>({
    resolver: zodFormResolver(savingsDepositSchema),
    defaultValues: {
      from_account_id: '', amount: EMPTY_NUMBER, date: '', memo: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: '', target_amount: EMPTY_NUMBER,
      deadline: '', icon: '', color: '', sort_order: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (g: SavingsGoalResponse) => {
    setEditing(g);
    form.reset({
      name: g.name,
      target_amount: g.target_amount,
      deadline: g.deadline || '',
      icon: g.icon || '',
      color: g.color || '',
      sort_order: g.sort_order,
    });
    setDialogOpen(true);
  };

  const openDepositDialog = (g: SavingsGoalResponse) => {
    setDepositDialog(g);
    const today = new Date().toISOString().slice(0, 10);
    depositForm.reset({
      from_account_id: '', amount: EMPTY_NUMBER, date: today, memo: '',
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: SavingsGoalFormData) => savingsGoalApi.create({
      name: data.name,
      target_amount: data.target_amount,
      deadline: data.deadline || undefined,
      icon: data.icon || undefined,
      color: data.color || undefined,
      sort_order: data.sort_order,
    }),
    onSuccess: () => {
      invalidateAll();
      setDialogOpen(false);
      setSnackMsg('貯蓄目標を作成しました');
    },
    onError: () => setError('貯蓄目標の作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: SavingsGoalFormData) => savingsGoalApi.update(editing!.id, {
      name: data.name,
      target_amount: data.target_amount,
      deadline: data.deadline || undefined,
      icon: data.icon || undefined,
      color: data.color || undefined,
      sort_order: data.sort_order,
      version: editing!.version,
    }),
    onSuccess: () => {
      invalidateAll();
      setDialogOpen(false);
      setSnackMsg('貯蓄目標を更新しました');
    },
    onError: () => setError('貯蓄目標の更新に失敗しました'),
  });

  const depositMutation = useMutation({
    mutationFn: (data: SavingsDepositFormData) =>
      savingsGoalApi.deposit(depositDialog!.id, {
        from_account_id: data.from_account_id,
        amount: data.amount,
        date: data.date || undefined,
        memo: data.memo || undefined,
      }),
    onSuccess: () => {
      invalidateAll();
      setDepositDialog(null);
      setSnackMsg('積立を実行しました');
    },
    onError: () => setError('積立に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (g: SavingsGoalResponse) => savingsGoalApi.delete(g.id, g.version),
    onSuccess: () => {
      invalidateAll();
      setSnackMsg('貯蓄目標を削除しました');
    },
    onError: () => setError('貯蓄目標の削除に失敗しました'),
  });

  const onSubmit = (data: SavingsGoalFormData) => {
    setError(null);
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const onDeposit = (data: SavingsDepositFormData) => {
    setError(null);
    depositMutation.mutate(data);
  };

  const filteredGoals = goals?.filter((g) => {
    if (statusFilter === 'all') return true;
    return g.status === statusFilter;
  });

  const activeGoals = goals?.filter((g) => g.status === 'active') ?? [];
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0);
  const totalCurrent = activeGoals.reduce((s, g) => s + g.current_amount, 0);
  const totalPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  const getProgressColor = (rate: number) => {
    if (rate >= 100) return 'success.main';
    if (rate >= 60) return 'primary.main';
    if (rate >= 30) return 'warning.main';
    return 'error.main';
  };

  const getProgressBarColor = (rate: number): 'success' | 'primary' | 'warning' | 'error' => {
    if (rate >= 100) return 'success';
    if (rate >= 60) return 'primary';
    if (rate >= 30) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', mb: isMobile ? 2 : 3, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 2 }}>
        {!isMobile && <Typography variant="h5" fontWeight={700}>貯蓄目標</Typography>}
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'achieved')}
              displayEmpty
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="active">進行中</MenuItem>
              <MenuItem value="achieved">達成済み</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" size={isMobile ? 'small' : 'medium'} startIcon={<Add />} onClick={openCreate}>追加</Button>
        </Stack>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Summary */}
      {activeGoals.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">目標総額</Typography>
              <Typography variant="h5" fontWeight={700}>{formatCurrency(totalTarget)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">現在の積立総額</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">{formatCurrency(totalCurrent)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">全体進捗</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(totalPct, 100)}
                  color={getProgressBarColor(totalPct)}
                  sx={{ flex: 1, height: 10, borderRadius: 5 }}
                />
                <Typography fontWeight={600}>{totalPct.toFixed(1)}%</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {isLoading ? <CircularProgress /> : filteredGoals?.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <SavingsOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">
            {statusFilter === 'all' ? '貯蓄目標がありません' : statusFilter === 'active' ? '進行中の目標がありません' : '達成済みの目標がありません'}
          </Typography>
          {statusFilter !== 'achieved' && (
            <Button variant="outlined" sx={{ mt: 2 }} onClick={openCreate}>最初の目標を作成する</Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredGoals?.map((g) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={g.id}>
              <Card variant="outlined" sx={{ position: 'relative', overflow: 'visible' }}>
                {g.status === 'achieved' && (
                  <Chip
                    icon={<EmojiEvents sx={{ fontSize: 16 }} />}
                    label="達成"
                    color="success"
                    size="small"
                    sx={{ position: 'absolute', top: -10, right: 12 }}
                  />
                )}
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {g.icon ? (
                        <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: g.color || 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon sx={{ color: '#fff', fontSize: 18 }}>{g.icon}</Icon>
                        </Box>
                      ) : g.color ? (
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: g.color }} />
                      ) : null}
                      <Typography fontWeight={600}>{g.name}</Typography>
                    </Box>
                    <Box>
                      {g.status === 'active' && (
                        <Button size="small" variant="text" onClick={() => openDepositDialog(g)} sx={{ minWidth: 'auto', px: 1 }}>
                          積立
                        </Button>
                      )}
                      <IconButton size="small" onClick={() => openEdit(g)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirm(g)}><Delete fontSize="small" /></IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color={getProgressColor(g.progress_rate)}>
                      {g.progress_rate.toFixed(1)}%
                    </Typography>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={Math.min(g.progress_rate, 100)}
                    color={getProgressBarColor(g.progress_rate)}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />

                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      残り {formatCurrency(g.remaining_amount)}
                    </Typography>
                    {g.deadline && (
                      <Typography variant="caption" color="text.secondary">
                        期限: {g.deadline}
                      </Typography>
                    )}
                    {g.monthly_recommended != null && g.status === 'active' && (
                      <Typography variant="caption" color="info.main">
                        月あたり推奨積立額: {formatCurrency(g.monthly_recommended)}
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? '貯蓄目標の編集' : '貯蓄目標の作成'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="savings-goal-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField fullWidth label="目標名" {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} placeholder="例: 旅行資金、緊急資金" />
              <TextField fullWidth label="目標額" type="number" inputProps={{ step: 1, min: 1 }} {...form.register('target_amount', { valueAsNumber: true })} error={!!form.formState.errors.target_amount} helperText={form.formState.errors.target_amount?.message} />
              <TextField fullWidth label="期限" type="date" InputLabelProps={{ shrink: true }} {...form.register('deadline')} />
              <Controller name="icon" control={form.control} render={({ field }) => (
                <IconPicker value={field.value ?? ''} onChange={field.onChange} error={!!form.formState.errors.icon} helperText={form.formState.errors.icon?.message} />
              )} />
              <TextField fullWidth label="カラー" type="color" InputLabelProps={{ shrink: true }} {...form.register('color')} sx={{ '& input': { height: 40 } }} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="savings-goal-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={!!depositDialog} onClose={() => setDepositDialog(null)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>積立</DialogTitle>
        <DialogContent>
          <Box component="form" id="deposit-form" onSubmit={depositForm.handleSubmit(onDeposit)} noValidate sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              「{depositDialog?.name}」に積立します
            </Typography>
            {depositDialog && (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                目標額: {formatCurrency(depositDialog.target_amount)}　現在: {formatCurrency(depositDialog.current_amount)}　残り: {formatCurrency(depositDialog.remaining_amount)}
              </Typography>
            )}
            <Stack spacing={2}>
              <Controller name="from_account_id" control={depositForm.control} render={({ field }) => (
                <FormControl fullWidth error={!!depositForm.formState.errors.from_account_id}>
                  <InputLabel>出金元決済手段</InputLabel>
                  <Select {...field} value={field.value ?? ''} label="出金元決済手段">
                    {accounts?.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}（{formatCurrency(a.balance)}）</MenuItem>)}
                  </Select>
                  {depositForm.formState.errors.from_account_id && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {depositForm.formState.errors.from_account_id.message}
                    </Typography>
                  )}
                </FormControl>
              )} />
              <TextField
                fullWidth
                label="積立額"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                {...depositForm.register('amount', { valueAsNumber: true })}
                error={!!depositForm.formState.errors.amount}
                helperText={depositForm.formState.errors.amount?.message}
              />
              <TextField fullWidth label="日付" type="date" InputLabelProps={{ shrink: true }} {...depositForm.register('date')} />
              <TextField fullWidth label="メモ（任意）" {...depositForm.register('memo')} multiline rows={2} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialog(null)}>キャンセル</Button>
          <Button type="submit" form="deposit-form" variant="contained" disabled={depositMutation.isPending}>
            {depositMutation.isPending ? <CircularProgress size={20} /> : '積立実行'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>貯蓄目標の削除</DialogTitle>
        <DialogContent>
          <Typography>「{deleteConfirm?.name}」を削除しますか？</Typography>
          <Typography variant="caption" color="text.secondary">紐付く貯蓄口座も削除されます。</Typography>
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
