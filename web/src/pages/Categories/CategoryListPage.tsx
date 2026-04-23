import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Icon,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import { useMobile } from '@/hooks/useMobile';
import { Icon as UiIcon } from '@/components/Icon';
import { useForm, Controller } from 'react-hook-form';
import { categorySchema, type CategoryFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { categoryApi } from '@/api/categories';
import type { CategoryResponse } from '@/types';
import IconPicker from '@/components/IconPicker';

export default function CategoryListPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list(),
    select: (res) => res.data.filter((c) => !c.deleted_at),
  });

  const form = useForm<CategoryFormData>({
    resolver: zodFormResolver(categorySchema),
    defaultValues: { name: '', type: 'expense', icon: '', color: '', sort_order: 0 },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', type: 'expense', icon: '', color: '', sort_order: 0 });
    setDialogOpen(true);
  };

  const openEdit = (c: CategoryResponse) => {
    setEditing(c);
    form.reset({ name: c.name, type: c.type, icon: c.icon || '', color: c.color || '', sort_order: c.sort_order });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      categoryApi.create({ ...data, icon: data.icon || undefined, color: data.color || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDialogOpen(false); },
    onError: () => setError('カテゴリの作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      categoryApi.update(editing!.id, { ...data, icon: data.icon || undefined, color: data.color || undefined, version: editing!.version }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDialogOpen(false); },
    onError: () => setError('カテゴリの更新に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (c: CategoryResponse) => categoryApi.delete(c.id, c.version),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDeleteConfirm(null); },
    onError: () => setError('カテゴリの削除に失敗しました'),
  });

  const onSubmit = (data: CategoryFormData) => {
    setError(null);
    editing ? updateMutation.mutate(data) : createMutation.mutate(data);
  };

  return (
    <Box>
      <div className="page-h">
        <div>
          <h1>カテゴリ管理</h1>
          <div className="sub">
            {categories?.length ?? 0} 件 · 収入と支出の分類
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <UiIcon name="plus" size={14} stroke={2.4} /> カテゴリ追加
          </button>
        </div>
      </div>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {isMobile ? (
        isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={1}>
            {categories?.map((c) => (
              <Paper key={c.id} variant="outlined" sx={{ p: 1.5, cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }} onClick={() => openEdit(c)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: c.color || 'grey.300', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {c.icon && <Icon sx={{ color: '#fff', fontSize: 20 }}>{c.icon}</Icon>}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    <Chip size="small" label={c.type === 'income' ? '収入' : '支出'} color={c.type === 'income' ? 'success' : 'error'} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Box>
                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c); }} disabled={c.is_default}><Delete fontSize="small" /></IconButton>
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
                <TableCell>アイコン</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>種別</TableCell>
                <TableCell>デフォルト</TableCell>
                <TableCell>表示順</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
              ) : categories?.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: c.color || 'grey.300',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {c.icon && <Icon sx={{ color: '#fff', fontSize: 20 }}>{c.icon}</Icon>}
                    </Box>
                  </TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.type === 'income' ? '収入' : '支出'} color={c.type === 'income' ? 'success' : 'error'} variant="outlined" />
                  </TableCell>
                  <TableCell>{c.is_default ? 'はい' : '-'}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(c)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(c)} disabled={c.is_default}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? 'カテゴリの編集' : 'カテゴリの追加'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="category-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField fullWidth label="カテゴリ名" {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} />
              <Controller name="type" control={form.control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>種別</InputLabel>
                  <Select {...field} label="種別">
                    <MenuItem value="expense">支出</MenuItem>
                    <MenuItem value="income">収入</MenuItem>
                  </Select>
                </FormControl>
              )} />
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
              <TextField fullWidth label="カラー" type="color" {...form.register('color')} InputLabelProps={{ shrink: true }} />
              <TextField fullWidth label="表示順" type="number" {...form.register('sort_order', { valueAsNumber: true })} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="category-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>カテゴリの削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{deleteConfirm?.name}」を削除しますか？
            このカテゴリに紐づく取引は予備カテゴリに自動振り替えされます。
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
