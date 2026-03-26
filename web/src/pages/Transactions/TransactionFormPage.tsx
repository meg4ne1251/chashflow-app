import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  OutlinedInput,
  Alert,
  CircularProgress,
  Stack,
  Autocomplete,
  Icon,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { transactionSchema, type TransactionFormData } from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { transactionApi } from '@/api/transactions';
import { categoryApi } from '@/api/categories';
import { accountApi } from '@/api/accounts';
import { tagApi } from '@/api/tags';
import { suggestionApi } from '@/api/suggestions';
import { getNow } from '@/utils/format';
import { DEBOUNCE_DELAY_MS, AUTO_COMPLETE_CONFIDENCE_THRESHOLD, MEMO_SUGGESTION_MIN_LENGTH } from '@/constants';
import { useMobile } from '@/hooks/useMobile';

export default function TransactionFormPage() {
  const isMobile = useMobile();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const templateData = (location.state as { template?: import('@/types').TemplateResponse } | null)?.template;
  const [memoSuggestions, setMemoSuggestions] = useState<string[]>([]);
  const memoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
    };
  }, []);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list(),
    select: (res) => res.data.filter((c) => !c.deleted_at),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
    select: (res) => res.data.filter((a) => !a.deleted_at),
  });

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.list(),
    select: (res) => res.data.filter((t) => !t.deleted_at),
  });

  const { data: existingTx, isLoading: loadingTx } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionApi.get(id!),
    select: (res) => res.data,
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodFormResolver(transactionSchema),
    defaultValues: {
      name: '',
      type: 'expense',
      amount: undefined,
      date: getNow(),
      category_id: '',
      account_id: '',
      memo: '',
      currency: 'JPY',
      tag_ids: [],
    },
  });

  const selectedType = watch('type');

  // Populate form for editing
  useEffect(() => {
    if (existingTx) {
      reset({
        name: existingTx.name || '',
        type: existingTx.type,
        amount: existingTx.amount,
        date: existingTx.date,
        category_id: existingTx.category_id || '',
        account_id: existingTx.account_id || '',
        memo: existingTx.memo || '',
        currency: existingTx.currency,
        tag_ids: existingTx.tags.map((t) => t.id),
      });
    }
  }, [existingTx, reset]);

  // Pre-fill from template
  useEffect(() => {
    if (templateData && !isEdit) {
      reset({
        name: templateData.transaction_name || '',
        type: templateData.type,
        amount: templateData.amount ?? undefined,
        date: getNow(),
        category_id: templateData.category_id || '',
        account_id: templateData.account_id || '',
        memo: templateData.memo || '',
        currency: templateData.currency || 'JPY',
        tag_ids: templateData.tags.map((t) => t.id),
      });
    }
  }, [templateData, isEdit, reset]);

  // Memo auto-complete (debounced)
  const handleMemoChange = (value: string) => {
    if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
    if (value.length < MEMO_SUGGESTION_MIN_LENGTH) {
      setMemoSuggestions([]);
      return;
    }
    memoDebounceRef.current = setTimeout(async () => {
      try {
        const res = await suggestionApi.memo(value);
        setMemoSuggestions(res.data.map((s) => s.memo));
      } catch (err) {
        console.warn('Memo suggestion failed:', err);
      }

      // Auto-complete category/account
      try {
        const res = await suggestionApi.autoComplete(value);
        if (res.data.category_id && res.data.confidence > AUTO_COMPLETE_CONFIDENCE_THRESHOLD) {
          setValue('category_id', res.data.category_id);
        }
        if (res.data.account_id && res.data.confidence > AUTO_COMPLETE_CONFIDENCE_THRESHOLD) {
          setValue('account_id', res.data.account_id);
        }
      } catch (err) {
        console.warn('Auto-complete failed:', err);
      }
    }, DEBOUNCE_DELAY_MS);
  };

  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      transactionApi.create({
        ...data,
        name: data.name || undefined,
        memo: data.memo || undefined,
        category_id: data.category_id || undefined,
        account_id: data.account_id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/transactions');
    },
    onError: () => setError('取引の作成に失敗しました'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      transactionApi.update(id!, {
        ...data,
        name: data.name || undefined,
        memo: data.memo || undefined,
        category_id: data.category_id || undefined,
        account_id: data.account_id || undefined,
        version: existingTx!.version,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.removeQueries({ queryKey: ['transaction', id] });
      navigate('/transactions');
    },
    onError: () => {
      setError('取引の更新に失敗しました');
      // Refetch to get the latest version from server
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isEdit && loadingTx) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const filteredCategories = categories?.filter((c) => c.type === selectedType) || [];

  return (
    <Box sx={{ maxWidth: isMobile ? '100%' : 600, mx: 'auto' }}>
      {!isMobile && (
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {isEdit ? '取引の編集' : '新規取引'}
        </Typography>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>種別</InputLabel>
                    <Select {...field} label="種別" onChange={(e) => { field.onChange(e); setValue('category_id', ''); }}>
                      <MenuItem value="expense">支出</MenuItem>
                      <MenuItem value="income">収入</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />

              <TextField
                fullWidth
                label="名前"
                placeholder="例: スーパーで買い物"
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
              />

              <TextField
                fullWidth
                label="金額"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                {...register('amount', { valueAsNumber: true })}
                error={!!errors.amount}
                helperText={errors.amount?.message}
              />

              <TextField
                fullWidth
                label="日時"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                {...register('date')}
                error={!!errors.date}
                helperText={errors.date?.message}
              />

              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>カテゴリ</InputLabel>
                    <Select {...field} label="カテゴリ">
                      <MenuItem value="">
                        <em>未選択</em>
                      </MenuItem>
                      {filteredCategories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.icon ? (
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                bgcolor: c.color || 'grey.300',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mr: 1,
                                flexShrink: 0,
                              }}
                            >
                              <Icon sx={{ color: '#fff', fontSize: 16 }}>{c.icon}</Icon>
                            </Box>
                          ) : c.color ? (
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-block',
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: c.color,
                                mr: 1,
                              }}
                            />
                          ) : null}
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                                  </FormControl>
                )}
              />

              <Controller
                name="account_id"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>決済手段</InputLabel>
                    <Select {...field} label="決済手段">
                      <MenuItem value="">
                        <em>未選択</em>
                      </MenuItem>
                      {accounts?.map((a) => (
                        <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="memo"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    options={memoSuggestions}
                    inputValue={field.value || ''}
                    onInputChange={(_e, value) => {
                      field.onChange(value);
                      handleMemoChange(value);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="メモ"
                        error={!!errors.memo}
                        helperText={errors.memo?.message}
                      />
                    )}
                  />
                )}
              />

              <Controller
                name="tag_ids"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>タグ</InputLabel>
                    <Select
                      multiple
                      value={field.value}
                      onChange={field.onChange}
                      input={<OutlinedInput label="タグ" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((id) => {
                            const tag = tags?.find((t) => t.id === id);
                            return (
                              <Chip
                                key={id}
                                size="small"
                                label={tag?.name || id}
                                sx={tag?.color ? { bgcolor: tag.color, color: '#fff' } : {}}
                              />
                            );
                          })}
                        </Box>
                      )}
                    >
                      {tags?.map((t) => (
                        <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => navigate('/transactions')}>
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || updateMutation.isPending || createMutation.isPending}
                  startIcon={isSubmitting || updateMutation.isPending || createMutation.isPending ? <CircularProgress size={20} /> : undefined}
                >
                  {isEdit ? '更新' : '登録'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
