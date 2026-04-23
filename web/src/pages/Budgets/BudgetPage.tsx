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
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import CategoryIcon from '@/components/CategoryIcon';
import { budgetSchema, type BudgetFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { budgetApi } from '@/api/budgets';
import { categoryApi } from '@/api/categories';
import { getCurrentYearMonth, shiftYearMonth } from '@/utils/format';
import { EMPTY_NUMBER } from '@/constants';
import type { BudgetResponse } from '@/types';

type StatusFilter = 'all' | 'over' | 'warn' | 'safe';

function statusOf(spent: number, budget: number, dayProg: number) {
  const pct = budget > 0 ? spent / budget : 0;
  if (pct >= 1)
    return { cls: 'over', label: '超過', chip: 'chip-neg', filter: 'over' as const };
  if (pct >= dayProg + 0.12)
    return { cls: 'warn', label: '要注意', chip: 'chip-warn', filter: 'warn' as const };
  return { cls: 'ok', label: '安全', chip: 'chip-pos', filter: 'safe' as const };
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BudgetResponse | null>(
    null,
  );
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const ymDate = dayjs(yearMonth + '-01');
  const isCurrentMonth = ymDate.isSame(dayjs(), 'month');
  const monthDays = ymDate.daysInMonth();
  const todayDay = isCurrentMonth ? dayjs().date() : monthDays;
  const dayProg = todayDay / monthDays;
  const daysLeft = Math.max(0, monthDays - todayDay);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', yearMonth],
    queryFn: () => budgetApi.list(yearMonth),
    select: (r) => r.data,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list(),
    select: (r) =>
      r.data.filter((c) => !c.deleted_at && c.type === 'expense'),
  });

  const form = useForm<BudgetFormData>({
    resolver: zodFormResolver(budgetSchema),
    defaultValues: {
      category_id: '',
      amount: EMPTY_NUMBER,
      year_month: yearMonth,
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      category_id: '',
      amount: EMPTY_NUMBER,
      year_month: yearMonth,
    });
    setDialogOpen(true);
  };

  const openEdit = (b: BudgetResponse) => {
    setEditing(b);
    form.reset({
      category_id: b.category_id,
      amount: b.amount,
      year_month: b.year_month,
    });
    setDialogOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: (data: BudgetFormData) =>
      budgetApi.upsert({
        budgets: [
          {
            category_id: data.category_id,
            amount: data.amount,
            year_month: data.year_month,
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setDialogOpen(false);
      setSnackMsg(editing ? '予算を更新しました' : '予算を設定しました');
    },
    onError: () => setError('予算の保存に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (b: BudgetResponse) => budgetApi.delete(b.id, b.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setSnackMsg('予算を削除しました');
    },
    onError: () => setError('予算の削除に失敗しました'),
  });

  const copyMutation = useMutation({
    mutationFn: async (sourceMonth: string) => {
      const source = await budgetApi.list(sourceMonth);
      if (source.data.length === 0) throw new Error('empty');
      return budgetApi.upsert({
        budgets: source.data.map((b) => ({
          category_id: b.category_id,
          year_month: yearMonth,
          amount: b.amount,
          currency: b.currency,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setCopyDialogOpen(false);
      setSnackMsg('予算をコピーしました');
    },
    onError: (err) =>
      setError(
        err instanceof Error && err.message === 'empty'
          ? 'コピー元の月に予算がありません'
          : '予算のコピーに失敗しました',
      ),
  });

  const onSubmit = (data: BudgetFormData) => {
    setError(null);
    upsertMutation.mutate(data);
  };

  const totalBudget = budgets?.reduce((s, b) => s + b.amount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spent, 0) ?? 0;
  const totalPct = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const paceTarget = totalBudget * dayProg;
  const diff = paceTarget - totalSpent;
  const remain = Math.max(0, totalBudget - totalSpent);
  const perDay = daysLeft > 0 ? Math.floor(remain / daysLeft) : 0;
  const eom = dayProg > 0 ? Math.floor(totalSpent / dayProg) : 0;
  const overCount = budgets?.filter((b) => b.spent > b.amount).length ?? 0;

  const filtered = useMemo(() => {
    if (!budgets) return [];
    if (filter === 'all') return budgets;
    return budgets.filter(
      (b) => statusOf(b.spent, b.amount, dayProg).filter === filter,
    );
  }, [budgets, filter, dayProg]);

  const monthLabel = ymDate.format('YYYY年M月');

  const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>予算管理</h1>
          <div className="sub">
            {monthLabel}
            {isCurrentMonth && ` · 残り ${daysLeft} 日`}
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="前の月"
            onClick={() => setYearMonth(shiftYearMonth(yearMonth, -1))}
          >
            <Icon name="chev-l" size={14} />
          </button>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            aria-label="年月"
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 9,
              border: '1px solid var(--border-soft)',
              background: 'var(--bg-2)',
              color: 'var(--text-1)',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="次の月"
            onClick={() => setYearMonth(shiftYearMonth(yearMonth, 1))}
          >
            <Icon name="chev-r" size={14} />
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCopyFrom('');
              setCopyDialogOpen(true);
            }}
          >
            <Icon name="folder" size={13} /> 前月コピー
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Icon name="plus" size={14} stroke={2.4} /> 予算追加
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

      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">今月の消化状況</div>
            <div
              className="hero-amt"
              style={totalPct > 1 ? { color: 'var(--neg-amt)' } : undefined}
            >
              <span className="yen">¥</span>
              {Math.round(totalSpent).toLocaleString('ja-JP')}
              <span
                style={{
                  fontSize: 16,
                  color: 'var(--text-3)',
                  fontWeight: 400,
                  fontFamily: 'var(--font-sans)',
                  marginLeft: 8,
                }}
              >
                / ¥{totalBudget.toLocaleString('ja-JP')}
              </span>
            </div>
            <div className="hero-sub">
              {totalBudget > 0 ? (
                diff > 0 ? (
                  <span className="chip chip-pos">
                    <Icon name="check" size={11} /> ペースより{' '}
                    {yen(diff)} 余裕
                  </span>
                ) : (
                  <span className="chip chip-warn">
                    ペース超過 {yen(-diff)}
                  </span>
                )
              ) : (
                <span className="chip">予算未設定</span>
              )}
              {daysLeft > 0 && totalBudget > 0 && (
                <span>
                  1日あたり残り使える額{' '}
                  <span
                    className="mono"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {yen(perDay)}
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-l">残額</div>
              <div className="kpi-v mono">
                {yen(totalBudget - totalSpent)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-l">月末予測</div>
              <div className="kpi-v mono">{yen(eom)}</div>
              {totalBudget > 0 && (
                <div
                  className={
                    'kpi-sub chip ' +
                    (eom > totalBudget ? 'chip-neg' : 'chip-pos')
                  }
                >
                  {eom > totalBudget ? '超過予測' : '予算内'}
                </div>
              )}
            </div>
            <div className="kpi">
              <div className="kpi-l">超過カテゴリ</div>
              <div className="kpi-v mono">
                {overCount}
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    marginLeft: 4,
                  }}
                >
                  / {budgets?.length ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
        {totalBudget > 0 && (
          <div className="pace-wrap">
            <div className="bar">
              <i style={{ width: `${Math.min(totalPct, 1) * 100}%` }} />
              <span
                className="pace"
                style={{ left: `${dayProg * 100}%` }}
              />
            </div>
            <div className="pace-row" style={{ marginTop: 14 }}>
              <span className="muted">
                消化 {Math.round(totalPct * 100)}%
              </span>
              <span
                className="mono dim"
                style={{ fontSize: 11 }}
              >
                月進捗 {Math.round(dayProg * 100)}% · {ymDate.month() + 1}/{todayDay}
              </span>
              <span
                className="muted"
                style={{ textAlign: 'right' }}
              >
                月末まで残 {daysLeft} 日
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 20 }} />

      <div className="card-h" style={{ padding: '0 4px' }}>
        <h3>カテゴリ別 予算</h3>
        <div className="row" style={{ gap: 4 }}>
          {(['all', 'over', 'warn', 'safe'] as const).map((f) => (
            <button
              type="button"
              key={f}
              className={'filter-pill' + (filter === f ? ' active' : '')}
              onClick={() => setFilter(f)}
            >
              {f === 'all'
                ? 'すべて'
                : f === 'over'
                  ? '超過'
                  : f === 'warn'
                    ? '要注意'
                    : '安全'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : !budgets || budgets.length === 0 ? (
        <div
          className="card"
          style={{ padding: 32, textAlign: 'center', marginTop: 16 }}
        >
          <div style={{ color: 'var(--text-3)', marginBottom: 12 }}>
            予算が設定されていません
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Icon name="plus" size={14} stroke={2.4} /> 最初の予算を設定する
          </button>
        </div>
      ) : (
        <div className="grid-12" style={{ marginTop: 12 }}>
          {filtered.map((b) => {
            const pct = b.amount > 0 ? b.spent / b.amount : 0;
            const paceT = b.amount * dayProg;
            const dDiff = paceT - b.spent;
            const r = Math.max(0, b.amount - b.spent);
            const pDay = daysLeft > 0 ? Math.floor(r / daysLeft) : 0;
            const status = statusOf(b.spent, b.amount, dayProg);
            return (
              <div className="col-4" key={b.id}>
                <div className="card bud-card">
                  <div className="bud-card-h">
                    <CategoryIcon
                      icon={b.category?.icon}
                      color={b.category?.color}
                      size={36}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bud-card-name">
                        {b.category?.name ?? 'カテゴリ不明'}
                      </div>
                      <div className="bud-card-sub">
                        予算 ¥{b.amount.toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <span className={'chip ' + status.chip}>
                      {status.label}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="編集"
                      onClick={() => openEdit(b)}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="削除"
                      onClick={() => setDeleteConfirm(b)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>

                  <div className="bud-amt">
                    <div className="bud-amt-main mono">
                      ¥{b.spent.toLocaleString('ja-JP')}
                      <span className="bud-amt-pct">
                        {' · '}
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                    <div className="bud-amt-sub muted">
                      {pct >= 1 ? (
                        <span className="t-down">
                          {yen(b.spent - b.amount)} 超過
                        </span>
                      ) : (
                        <>
                          残{' '}
                          <span
                            className="mono"
                            style={{ color: 'var(--text-2)' }}
                          >
                            {yen(r)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={'bar ' + status.cls}>
                    <i
                      style={{
                        width: `${Math.min(pct, 1) * 100}%`,
                      }}
                    />
                    <span
                      className="pace"
                      style={{ left: `${dayProg * 100}%` }}
                    />
                  </div>

                  <div className="bud-foot">
                    <div className="bud-foot-item">
                      <div className="bud-foot-l">ペース差</div>
                      <div
                        className={
                          'bud-foot-v mono ' +
                          (dDiff >= 0 ? 't-up' : 't-down')
                        }
                      >
                        {dDiff >= 0 ? '−' : '+'}
                        {yen(Math.abs(dDiff))}
                      </div>
                    </div>
                    <div className="bud-foot-item">
                      <div className="bud-foot-l">1日あたり使える</div>
                      <div className="bud-foot-v mono">
                        {pct >= 1 ? '—' : yen(pDay)}
                      </div>
                    </div>
                    <div className="bud-foot-item">
                      <div className="bud-foot-l">月末予測</div>
                      <div className="bud-foot-v mono">
                        {dayProg > 0
                          ? yen(b.spent / dayProg)
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-12">
              <div
                className="card"
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--text-3)',
                }}
              >
                該当する予算がありません
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{editing ? '予算の編集' : '予算の設定'}</DialogTitle>
        <DialogContent>
          <Box
            component="form"
            id="budget-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            sx={{ pt: 1 }}
          >
            <Stack spacing={2}>
              <Controller
                name="category_id"
                control={form.control}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    error={!!form.formState.errors.category_id}
                    disabled={!!editing}
                  >
                    <InputLabel>カテゴリ（支出）</InputLabel>
                    <Select {...field} label="カテゴリ（支出）">
                      {categories?.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
              <TextField
                fullWidth
                label="予算額"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                {...form.register('amount', { valueAsNumber: true })}
                error={!!form.formState.errors.amount}
                helperText={form.formState.errors.amount?.message}
              />
              <TextField
                fullWidth
                label="年月"
                type="month"
                InputLabelProps={{ shrink: true }}
                {...form.register('year_month')}
                disabled={!!editing}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="budget-form" variant="contained">
            {editing ? '更新' : '設定'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
      >
        <DialogTitle>予算の削除</DialogTitle>
        <DialogContent>
          「{deleteConfirm?.category?.name ?? 'カテゴリ不明'}」の予算を削除しますか？
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

      <Dialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>他の月から予算をコピー</DialogTitle>
        <DialogContent>
          <Box sx={{ color: 'text.secondary', mb: 2, fontSize: 13 }}>
            コピー元の月を選択してください。選択した月の予算が {yearMonth}{' '}
            にコピーされます。
          </Box>
          <TextField
            fullWidth
            label="コピー元の月"
            type="month"
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          {copyFrom === yearMonth && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              コピー元とコピー先が同じ月です
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            disabled={
              !copyFrom || copyFrom === yearMonth || copyMutation.isPending
            }
            onClick={() => copyMutation.mutate(copyFrom)}
          >
            {copyMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              'コピー'
            )}
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
