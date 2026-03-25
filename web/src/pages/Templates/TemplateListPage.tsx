import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography, Paper, Alert, Stack, CircularProgress,
  Chip, FormControl, InputLabel, Select, MenuItem, OutlinedInput,
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, PlayArrow } from '@mui/icons-material';
import { useMobile } from '@/hooks/useMobile';
import { useForm, Controller } from 'react-hook-form';
import { templateSchema, type TemplateFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { templateApi } from '@/api/templates';
import { categoryApi } from '@/api/categories';
import { accountApi } from '@/api/accounts';
import { tagApi } from '@/api/tags';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { TemplateResponse } from '@/types';

export default function TemplateListPage() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateResponse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TemplateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list(),
    select: (res) => res.data.filter((t) => !t.deleted_at),
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list(), select: (r) => r.data.filter((c) => !c.deleted_at) });
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => accountApi.list(), select: (r) => r.data.filter((a) => !a.deleted_at) });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: () => tagApi.list(), select: (r) => r.data.filter((t) => !t.deleted_at) });

  const form = useForm<TemplateFormData>({
    resolver: zodFormResolver(templateSchema),
    defaultValues: { name: '', type: 'expense', amount: undefined, currency: 'JPY', category_id: '', account_id: '', memo: '', tag_ids: [] },
  });

  const selectedType = form.watch('type');
  const filteredCategories = categories?.filter((c) => c.type === selectedType) || [];

  const openCreate = () => { setEditing(null); form.reset({ name: '', type: 'expense', amount: undefined, currency: 'JPY', category_id: '', account_id: '', memo: '', tag_ids: [] }); setDialogOpen(true); };
  const openEdit = (t: TemplateResponse) => {
    setEditing(t);
    form.reset({ name: t.name, type: t.type, amount: t.amount ?? undefined, currency: t.currency, category_id: t.category_id || '', account_id: t.account_id || '', memo: t.memo || '', tag_ids: t.tags.map((tg) => tg.id) });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: TemplateFormData) => templateApi.create({ ...data, amount: data.amount ?? undefined, category_id: data.category_id || undefined, account_id: data.account_id || undefined, memo: data.memo || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); setDialogOpen(false); },
    onError: () => setError('テンプレートの作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TemplateFormData) => templateApi.update(editing!.id, { ...data, amount: data.amount ?? undefined, category_id: data.category_id || undefined, account_id: data.account_id || undefined, memo: data.memo || undefined, version: editing!.version }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); setDialogOpen(false); },
    onError: () => setError('テンプレートの更新に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (t: TemplateResponse) => templateApi.delete(t.id, t.version),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); setDeleteConfirm(null); },
    onError: () => setError('テンプレートの削除に失敗しました'),
  });

  const onSubmit = (data: TemplateFormData) => { setError(null); editing ? updateMutation.mutate(data) : createMutation.mutate(data); };

  const handleUseTemplate = (t: TemplateResponse) => {
    templateApi.use(t.id).catch((err) => {
      console.warn('Failed to record template usage:', err);
    });
    navigate('/transactions/new', { state: { template: t } });
  };

  return (
    <Box>
      {!isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>テンプレート管理</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>追加</Button>
        </Box>
      )}
      {isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={openCreate}>追加</Button>
        </Box>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {isMobile ? (
        isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={1}>
            {templates?.map((t) => (
              <Paper key={t.id} variant="outlined" sx={{ p: 1.5, cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }} onClick={() => openEdit(t)}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                      <Chip size="small" label={t.type === 'income' ? '収入' : '支出'} color={t.type === 'income' ? 'success' : 'error'} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t.amount ? formatCurrency(t.amount) : '金額未設定'} / {t.use_count}回使用
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0}>
                    <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleUseTemplate(t); }}><PlayArrow fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(t); }}><Delete fontSize="small" /></IconButton>
                  </Stack>
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
                <TableCell>名前</TableCell>
                <TableCell>種別</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell>使用回数</TableCell>
                <TableCell>最終使用</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
              ) : templates?.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.name}</TableCell>
                  <TableCell><Chip size="small" label={t.type === 'income' ? '収入' : '支出'} color={t.type === 'income' ? 'success' : 'error'} variant="outlined" /></TableCell>
                  <TableCell align="right">{t.amount ? formatCurrency(t.amount) : '-'}</TableCell>
                  <TableCell>{t.use_count}回</TableCell>
                  <TableCell>{t.last_used_at ? formatDateTime(t.last_used_at) : '-'}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="この内容で取引を登録"><IconButton size="small" color="primary" onClick={() => handleUseTemplate(t)}><PlayArrow fontSize="small" /></IconButton></Tooltip>
                    <IconButton size="small" onClick={() => openEdit(t)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(t)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? 'テンプレートの編集' : 'テンプレートの追加'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="template-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField fullWidth label="テンプレート名" {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} />
              <Controller name="type" control={form.control} render={({ field }) => (
                <FormControl fullWidth><InputLabel>種別</InputLabel><Select {...field} label="種別"><MenuItem value="expense">支出</MenuItem><MenuItem value="income">収入</MenuItem></Select></FormControl>
              )} />
              <TextField fullWidth label="金額（任意）" type="number" inputProps={{ step: 1 }}
                {...form.register('amount', { setValueAs: (v: string) => (v === '' || v == null) ? undefined : Number(v) })}
                error={!!form.formState.errors.amount} helperText={form.formState.errors.amount?.message} />
              <Controller name="category_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth><InputLabel>カテゴリ（任意）</InputLabel><Select {...field} label="カテゴリ（任意）"><MenuItem value="">未設定</MenuItem>{filteredCategories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl>
              )} />
              <Controller name="account_id" control={form.control} render={({ field }) => (
                <FormControl fullWidth><InputLabel>決済手段（任意）</InputLabel><Select {...field} label="決済手段（任意）"><MenuItem value="">未設定</MenuItem>{accounts?.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</Select></FormControl>
              )} />
              <TextField fullWidth label="メモ（任意）" {...form.register('memo')} />
              <Controller name="tag_ids" control={form.control} render={({ field }) => (
                <FormControl fullWidth><InputLabel>タグ</InputLabel>
                  <Select multiple value={field.value} onChange={field.onChange} input={<OutlinedInput label="タグ" />}
                    renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((id) => { const tag = tags?.find((tg) => tg.id === id); return <Chip key={id} size="small" label={tag?.name || id} />; })}</Box>)}>
                    {tags?.map((tg) => <MenuItem key={tg.id} value={tg.id}>{tg.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="template-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>テンプレートの削除</DialogTitle>
        <DialogContent><Typography>「{deleteConfirm?.name}」を削除しますか？</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>削除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
