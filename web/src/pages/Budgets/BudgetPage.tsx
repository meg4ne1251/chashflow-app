import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Grid, Card, CardContent, TextField,
  LinearProgress, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Stack, FormControl, InputLabel, Select,
  MenuItem, Alert, CircularProgress, Snackbar,
} from '@mui/material';
import { Add, Edit, Delete, ContentCopy, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { budgetSchema, type BudgetFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { budgetApi } from '@/api/budgets';
import { categoryApi } from '@/api/categories';
import { formatCurrency, getCurrentYearMonth, shiftYearMonth } from '@/utils/format';
import { EMPTY_NUMBER } from '@/constants';
import type { BudgetResponse } from '@/types';
import { useMobile } from '@/hooks/useMobile';

export default function BudgetPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BudgetResponse | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', yearMonth],
    queryFn: () => budgetApi.list(yearMonth),
    select: (r) => r.data,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list(),
    select: (r) => r.data.filter((c) => !c.deleted_at && c.type === 'expense'),
  });

  const form = useForm<BudgetFormData>({
    resolver: zodFormResolver(budgetSchema),
    defaultValues: { category_id: '', amount: EMPTY_NUMBER, year_month: yearMonth },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ category_id: '', amount: EMPTY_NUMBER, year_month: yearMonth });
    setDialogOpen(true);
  };

  const openEdit = (b: BudgetResponse) => {
    setEditing(b);
    form.reset({ category_id: b.category_id, amount: b.amount, year_month: b.year_month });
    setDialogOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: (data: BudgetFormData) => budgetApi.upsert({
      budgets: [{ category_id: data.category_id, amount: data.amount, year_month: data.year_month }],
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setSnackMsg('予算を削除しました'); },
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
    onError: (err) => setError(err instanceof Error && err.message === 'empty' ? 'コピー元の月に予算がありません' : '予算のコピーに失敗しました'),
  });

  const onSubmit = (data: BudgetFormData) => { setError(null); upsertMutation.mutate(data); };

  const totalBudget = budgets?.reduce((s, b) => s + b.amount, 0) ?? 0;
  const totalSpent = budgets?.reduce((s, b) => s + b.spent, 0) ?? 0;
  const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', mb: isMobile ? 2 : 3, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 2 }}>
        {!isMobile && <Typography variant="h5" fontWeight={700}>予算管理</Typography>}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" onClick={() => setYearMonth(shiftYearMonth(yearMonth, -1))}><ChevronLeft /></IconButton>
          <TextField label="年月" type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ flex: isMobile ? 1 : undefined }} />
          <IconButton size="small" onClick={() => setYearMonth(shiftYearMonth(yearMonth, 1))}><ChevronRight /></IconButton>
          <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<ContentCopy />} onClick={() => { setCopyFrom(''); setCopyDialogOpen(true); }}>コピー</Button>
          <Button variant="contained" size={isMobile ? 'small' : 'medium'} startIcon={<Add />} onClick={openCreate}>追加</Button>
        </Stack>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Summary */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="body2" color="text.secondary">総予算</Typography>
            <Typography variant="h5" fontWeight={700}>{formatCurrency(totalBudget)}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="body2" color="text.secondary">消化額</Typography>
            <Typography variant="h5" fontWeight={700} color={totalPct > 100 ? 'error.main' : 'text.primary'}>{formatCurrency(totalSpent)}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="body2" color="text.secondary">消化率</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress variant="determinate" value={Math.min(totalPct, 100)} sx={{ flex: 1, height: 10, borderRadius: 5, '& .MuiLinearProgress-bar': { bgcolor: totalPct > 100 ? 'error.main' : totalPct > 80 ? 'warning.main' : 'success.main' } }} />
              <Typography fontWeight={600}>{totalPct.toFixed(1)}%</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? <CircularProgress /> : budgets?.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">予算が設定されていません</Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={openCreate}>最初の予算を設定する</Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {budgets?.map((b) => {
            const spent = b.spent;
            const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            const remaining = b.amount - spent;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {b.category?.color && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: b.category.color }} />}
                        <Typography fontWeight={600}>{b.category?.name || 'カテゴリ不明'}</Typography>
                      </Box>
                      <Box>
                        <IconButton size="small" onClick={() => openEdit(b)}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(b)}><Delete fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">予算: {formatCurrency(b.amount)}</Typography>
                    <Typography variant="body2">使用: {formatCurrency(spent)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(pct, 100)}
                        sx={{ flex: 1, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: pct > 100 ? 'error.main' : pct > 80 ? 'warning.main' : 'primary.main' } }}
                      />
                      <Typography variant="body2" fontWeight={600}>{pct.toFixed(0)}%</Typography>
                    </Box>
                    <Typography variant="caption" color={remaining >= 0 ? 'text.secondary' : 'error'} sx={{ mt: 0.5, display: 'block' }}>
                      {remaining >= 0 ? `残り ${formatCurrency(remaining)}` : `${formatCurrency(Math.abs(remaining))} 超過`}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? '予算の編集' : '予算の設定'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="budget-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <Controller name="category_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth error={!!form.formState.errors.category_id} disabled={!!editing}>
                  <InputLabel>カテゴリ（支出）</InputLabel>
                  <Select {...field} label="カテゴリ（支出）">
                    {categories?.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
              <TextField fullWidth label="予算額" type="number" inputProps={{ step: 1, min: 1 }} {...form.register('amount', { valueAsNumber: true })} error={!!form.formState.errors.amount} helperText={form.formState.errors.amount?.message} />
              <TextField fullWidth label="年月" type="month" InputLabelProps={{ shrink: true }} {...form.register('year_month')} disabled={!!editing} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="budget-form" variant="contained">{editing ? '更新' : '設定'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>予算の削除</DialogTitle>
        <DialogContent>
          <Typography>「{deleteConfirm?.category?.name || 'カテゴリ不明'}」の予算を削除しますか？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={() => { if (deleteConfirm) { deleteMutation.mutate(deleteConfirm); setDeleteConfirm(null); } }}>削除</Button>
        </DialogActions>
      </Dialog>

      {/* Copy from another month */}
      <Dialog open={copyDialogOpen} onClose={() => setCopyDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>他の月から予算をコピー</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            コピー元の月を選択してください。選択した月の予算が {yearMonth} にコピーされます。
          </Typography>
          <TextField fullWidth label="コピー元の月" type="month" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          {copyFrom === yearMonth && (
            <Alert severity="warning" sx={{ mt: 1 }}>コピー元とコピー先が同じ月です</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" disabled={!copyFrom || copyFrom === yearMonth || copyMutation.isPending} onClick={() => copyMutation.mutate(copyFrom)}>
            {copyMutation.isPending ? <CircularProgress size={20} /> : 'コピー'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackMsg} autoHideDuration={3000} onClose={() => setSnackMsg(null)} message={snackMsg} sx={isMobile ? { bottom: 72 } : undefined} />
    </Box>
  );
}
