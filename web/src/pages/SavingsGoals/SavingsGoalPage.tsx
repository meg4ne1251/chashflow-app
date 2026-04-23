import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import DonutRing from '@/components/charts/DonutRing';
import IconPicker from '@/components/IconPicker';
import {
  savingsGoalSchema,
  savingsDepositSchema,
  type SavingsGoalFormData,
  type SavingsDepositFormData,
} from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { savingsGoalApi } from '@/api/savingsGoals';
import { accountApi } from '@/api/accounts';
import { formatCurrency } from '@/utils/format';
import { EMPTY_NUMBER } from '@/constants';
import type { SavingsGoalResponse } from '@/types';

type StatusFilter = 'all' | 'active' | 'achieved';

function monthsUntil(deadline: string): number {
  const t = dayjs(deadline);
  if (!t.isValid()) return 0;
  const today = dayjs();
  const diff = (t.year() - today.year()) * 12 + (t.month() - today.month());
  return Math.max(1, diff);
}

export default function SavingsGoalPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoalResponse | null>(null);
  const [depositDialog, setDepositDialog] =
    useState<SavingsGoalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] =
    useState<SavingsGoalResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [depositTargetId, setDepositTargetId] = useState<string | null>(null);

  const { data: goals, isLoading } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => savingsGoalApi.list(),
    select: (r) => r.data,
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
    select: (r) =>
      r.data.filter((a) => !a.deleted_at && a.type !== 'savings'),
  });

  const form = useForm<SavingsGoalFormData>({
    resolver: zodFormResolver(savingsGoalSchema),
    defaultValues: {
      name: '',
      target_amount: EMPTY_NUMBER,
      deadline: '',
      icon: '',
      color: '',
      sort_order: 0,
    },
  });

  const depositForm = useForm<SavingsDepositFormData>({
    resolver: zodFormResolver(savingsDepositSchema),
    defaultValues: {
      from_account_id: '',
      amount: EMPTY_NUMBER,
      date: '',
      memo: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: '',
      target_amount: EMPTY_NUMBER,
      deadline: '',
      icon: '',
      color: '',
      sort_order: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (g: SavingsGoalResponse) => {
    setEditing(g);
    form.reset({
      name: g.name,
      target_amount: g.target_amount,
      deadline: g.deadline ?? '',
      icon: g.icon ?? '',
      color: g.color ?? '',
      sort_order: g.sort_order,
    });
    setDialogOpen(true);
  };

  const openDepositDialog = (g: SavingsGoalResponse) => {
    setDepositDialog(g);
    setDepositTargetId(g.id);
    depositForm.reset({
      from_account_id: '',
      amount: EMPTY_NUMBER,
      date: dayjs().format('YYYY-MM-DD'),
      memo: '',
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: SavingsGoalFormData) =>
      savingsGoalApi.create({
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
    mutationFn: (data: SavingsGoalFormData) =>
      savingsGoalApi.update(editing!.id, {
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
    mutationFn: (data: SavingsDepositFormData & { goalId: string }) =>
      savingsGoalApi.deposit(data.goalId, {
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
    mutationFn: (g: SavingsGoalResponse) =>
      savingsGoalApi.delete(g.id, g.version),
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
    if (!depositTargetId) return;
    setError(null);
    depositMutation.mutate({ ...data, goalId: depositTargetId });
  };

  const filteredGoals = useMemo(() => {
    return (
      goals?.filter((g) => {
        if (statusFilter === 'all') return true;
        return g.status === statusFilter;
      }) ?? []
    );
  }, [goals, statusFilter]);

  const activeGoals = goals?.filter((g) => g.status === 'active') ?? [];
  const achievedCount = goals?.filter((g) => g.status === 'achieved').length ?? 0;
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0);
  const totalCurrent = activeGoals.reduce((s, g) => s + g.current_amount, 0);
  const overall = totalTarget > 0 ? totalCurrent / totalTarget : 0;

  const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>貯蓄目標</h1>
          <div className="sub">
            {goals?.length ?? 0} 件 · 全体進捗 {Math.round(overall * 100)}%
          </div>
        </div>
        <div className="actions">
          {(['all', 'active', 'achieved'] as const).map((f) => (
            <button
              type="button"
              key={f}
              className={'filter-pill' + (statusFilter === f ? ' active' : '')}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? 'すべて' : f === 'active' ? '進行中' : '達成済み'}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Icon name="plus" size={14} stroke={2.4} /> 目標を追加
          </button>
        </div>
      </div>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {activeGoals.length > 0 && (
        <div className="hero" style={{ padding: '20px 24px' }}>
          <div className="hero-top">
            <div>
              <div className="hero-label">現在の積立総額</div>
              <div className="hero-amt">
                <span className="yen">¥</span>
                {totalCurrent.toLocaleString('ja-JP')}
                <span
                  style={{
                    fontSize: 16,
                    color: 'var(--text-3)',
                    fontWeight: 400,
                    fontFamily: 'var(--font-sans)',
                    marginLeft: 8,
                  }}
                >
                  / 目標 {yen(totalTarget)}
                </span>
              </div>
              <div className="hero-sub">
                <span>達成 {achievedCount} 件 · 進行中 {activeGoals.length} 件</span>
              </div>
            </div>
          </div>
          <div className="pace-wrap">
            <div className="bar">
              <i style={{ width: `${Math.min(overall, 1) * 100}%` }} />
            </div>
            <div className="pace-row" style={{ marginTop: 14 }}>
              <span className="muted">¥0</span>
              <span className="mono dim" style={{ fontSize: 11 }}>
                {Math.round(overall * 100)}% 達成
              </span>
              <span className="muted" style={{ textAlign: 'right' }}>
                {yen(totalTarget)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : filteredGoals.length === 0 ? (
        <div
          className="card"
          style={{ padding: 32, textAlign: 'center' }}
        >
          <div
            style={{
              color: 'var(--text-3)',
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            {statusFilter === 'all'
              ? '貯蓄目標がありません'
              : statusFilter === 'active'
                ? '進行中の目標がありません'
                : '達成済みの目標がありません'}
          </div>
          {statusFilter !== 'achieved' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Icon name="plus" size={14} stroke={2.4} /> 最初の目標を作成
            </button>
          )}
        </div>
      ) : (
        <div className="grid-12">
          {filteredGoals.map((g) => {
            const pct = g.progress_rate / 100;
            const monthly =
              g.deadline && g.status === 'active'
                ? Math.ceil(
                    g.remaining_amount / Math.max(1, monthsUntil(g.deadline)),
                  )
                : 0;
            const color = g.color || 'var(--accent)';
            const isAchieved = g.status === 'achieved';
            return (
              <div className="col-6" key={g.id}>
                <div className="card goal-card">
                  <div className="goal-h">
                    <div
                      className="goal-icon"
                      style={
                        { '--goal-color': color } as React.CSSProperties
                      }
                    >
                      {g.icon ? (
                        <span
                          className="material-icons"
                          aria-hidden="true"
                          style={{ fontSize: 20, color }}
                        >
                          {g.icon}
                        </span>
                      ) : (
                        <Icon name="piggy" size={20} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="goal-name">{g.name}</div>
                      <div className="goal-due">
                        {g.deadline
                          ? `期日 ${g.deadline} まで残り ${monthsUntil(g.deadline)} ヶ月`
                          : '期日なし'}
                      </div>
                    </div>
                    {isAchieved ? (
                      <span className="chip chip-pos">
                        <Icon name="check" size={11} /> 達成
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => openDepositDialog(g)}
                      >
                        <Icon name="plus" size={12} /> 積立
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="編集"
                      onClick={() => openEdit(g)}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="削除"
                      onClick={() => setDeleteConfirm(g)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>

                  <div className="goal-ring">
                    <DonutRing
                      value={pct}
                      size={96}
                      stroke={10}
                      color={color}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="goal-stats">
                        <div className="cur">
                          {yen(g.current_amount)}
                        </div>
                        <div className="tgt">
                          / {yen(g.target_amount)} 目標
                        </div>
                      </div>
                      <div className="bar" style={{ marginTop: 12 }}>
                        <i
                          style={{
                            width: `${Math.min(pct, 1) * 100}%`,
                            background: color,
                          }}
                        />
                      </div>
                      <div
                        className="goal-meta"
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          残り{' '}
                          <span className="mono">
                            {yen(g.remaining_amount)}
                          </span>
                        </span>
                        {monthly > 0 && (
                          <span className="chip chip-info">
                            月あたり推奨 {yen(monthly)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editing ? '貯蓄目標の編集' : '貯蓄目標の作成'}
        </DialogTitle>
        <DialogContent>
          <Box
            component="form"
            id="savings-goal-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            sx={{ pt: 1 }}
          >
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="目標名"
                {...form.register('name')}
                error={!!form.formState.errors.name}
                helperText={form.formState.errors.name?.message}
                placeholder="例: 旅行資金、緊急資金"
              />
              <TextField
                fullWidth
                label="目標額"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                {...form.register('target_amount', { valueAsNumber: true })}
                error={!!form.formState.errors.target_amount}
                helperText={form.formState.errors.target_amount?.message}
              />
              <TextField
                fullWidth
                label="期限"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...form.register('deadline')}
              />
              <Controller
                name="icon"
                control={form.control}
                render={({ field }) => (
                  <IconPicker
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={!!form.formState.errors.icon}
                    helperText={form.formState.errors.icon?.message}
                  />
                )}
              />
              <TextField
                fullWidth
                label="カラー"
                type="color"
                InputLabelProps={{ shrink: true }}
                {...form.register('color')}
                sx={{ '& input': { height: 40 } }}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="savings-goal-form" variant="contained">
            {editing ? '更新' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!depositDialog}
        onClose={() => setDepositDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>積立</DialogTitle>
        <DialogContent>
          <Box
            component="form"
            id="deposit-form"
            onSubmit={depositForm.handleSubmit(onDeposit)}
            noValidate
            sx={{ pt: 1 }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              「{depositDialog?.name}」に積立します
            </Typography>
            {depositDialog && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 2, display: 'block' }}
              >
                目標額: {formatCurrency(depositDialog.target_amount)}　現在:{' '}
                {formatCurrency(depositDialog.current_amount)}　残り:{' '}
                {formatCurrency(depositDialog.remaining_amount)}
              </Typography>
            )}
            <Stack spacing={2}>
              <Controller
                name="from_account_id"
                control={depositForm.control}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    error={!!depositForm.formState.errors.from_account_id}
                  >
                    <InputLabel>出金元決済手段</InputLabel>
                    <Select
                      {...field}
                      value={field.value ?? ''}
                      label="出金元決済手段"
                    >
                      {accounts?.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name}（{formatCurrency(a.balance)}）
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
              <TextField
                fullWidth
                label="積立額"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                {...depositForm.register('amount', { valueAsNumber: true })}
                error={!!depositForm.formState.errors.amount}
                helperText={depositForm.formState.errors.amount?.message}
              />
              <TextField
                fullWidth
                label="日付"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...depositForm.register('date')}
              />
              <TextField
                fullWidth
                label="メモ（任意）"
                {...depositForm.register('memo')}
                multiline
                rows={2}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialog(null)}>キャンセル</Button>
          <Button
            type="submit"
            form="deposit-form"
            variant="contained"
            disabled={depositMutation.isPending}
          >
            {depositMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              '積立実行'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
      >
        <DialogTitle>貯蓄目標の削除</DialogTitle>
        <DialogContent>
          <Typography>「{deleteConfirm?.name}」を削除しますか？</Typography>
          <Typography variant="caption" color="text.secondary">
            紐付く貯蓄口座も削除されます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteConfirm) {
                deleteMutation.mutate(deleteConfirm);
                setDeleteConfirm(null);
              }
            }}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={3000}
        onClose={() => setSnackMsg(null)}
        message={snackMsg}
        sx={{
          bottom: { xs: 'calc(var(--bottom-tabs-h) + 16px)', sm: 24 },
        }}
      />
    </div>
  );
}
