import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography, Paper, Alert, Stack, CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { useMobile } from '@/hooks/useMobile';
import { useForm } from 'react-hook-form';
import { zodFormResolver } from '@/validation/resolver';
import { tagSchema, type TagFormData } from '@/validation/schemas';
import { tagApi } from '@/api/tags';
import { transactionApi } from '@/api/transactions';
import type { TagResponse } from '@/types';

export default function TagListPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagResponse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TagResponse | null>(null);
  const [deleteTagTxCount, setDeleteTagTxCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: tags, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.list(),
    select: (res) => res.data.filter((t) => !t.deleted_at),
  });

  const form = useForm<TagFormData>({
    resolver: zodFormResolver(tagSchema),
    defaultValues: { name: '', color: '' },
  });

  const openCreate = () => { setEditing(null); form.reset({ name: '', color: '' }); setDialogOpen(true); };
  const openEdit = (t: TagResponse) => { setEditing(t); form.reset({ name: t.name, color: t.color || '' }); setDialogOpen(true); };

  const createMutation = useMutation({
    mutationFn: (data: TagFormData) => tagApi.create({ ...data, color: data.color || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setDialogOpen(false); },
    onError: () => setError('タグの作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TagFormData) => tagApi.update(editing!.id, { ...data, color: data.color || undefined, version: editing!.version }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setDialogOpen(false); },
    onError: () => setError('タグの更新に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: (t: TagResponse) => tagApi.delete(t.id, t.version),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setDeleteConfirm(null); },
    onError: () => setError('タグの削除に失敗しました'),
  });

  const onSubmit = (data: TagFormData) => { setError(null); editing ? updateMutation.mutate(data) : createMutation.mutate(data); };

  const handleDeleteClick = async (t: TagResponse) => {
    setDeleteConfirm(t);
    setDeleteTagTxCount(null);
    try {
      const res = await transactionApi.list({ tag_ids: t.id, size: 1 });
      setDeleteTagTxCount(res.data.pagination.total_count ?? 0);
    } catch {
      setDeleteTagTxCount(0);
    }
  };

  return (
    <Box>
      {!isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>タグ管理</Typography>
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
            {tags?.map((t) => (
              <Paper key={t.id} variant="outlined" sx={{ p: 1.5, cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }} onClick={() => openEdit(t)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {t.color && <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />}
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{t.name}</Typography>
                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteClick(t); }}><Delete fontSize="small" /></IconButton>
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
                <TableCell>カラー</TableCell>
                <TableCell>名前</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} align="center"><CircularProgress /></TableCell></TableRow>
              ) : tags?.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.color && <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: t.color }} />}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(t)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteClick(t)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? 'タグの編集' : 'タグの追加'}</DialogTitle>
        <DialogContent>
          <Box component="form" id="tag-form" onSubmit={form.handleSubmit(onSubmit)} noValidate sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField fullWidth label="タグ名" {...form.register('name')} error={!!form.formState.errors.name} helperText={form.formState.errors.name?.message} />
              <TextField fullWidth label="カラー" type="color" {...form.register('color')} InputLabelProps={{ shrink: true }} />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button type="submit" form="tag-form" variant="contained">{editing ? '更新' : '作成'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>タグの削除</DialogTitle>
        <DialogContent>
          <Typography>「{deleteConfirm?.name}」を削除しますか？</Typography>
          {deleteTagTxCount === null ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">関連する取引数を確認中...</Typography>
            </Box>
          ) : deleteTagTxCount > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              このタグは {deleteTagTxCount} 件の取引に使用されています。削除すると、これらの取引からこのタグが除去されます。
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              このタグは取引に使用されていません。
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteTagTxCount === null}>削除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
