import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
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
  Stack,
  Icon,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  ContentPaste as TemplateIcon,
} from '@mui/icons-material';
import { transactionApi } from '@/api/transactions';
import { templateApi } from '@/api/templates';
import { categoryApi } from '@/api/categories';
import { accountApi } from '@/api/accounts';
import { tagApi } from '@/api/tags';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { useUndoStore } from '@/stores/undoStore';
import type { TransactionResponse, TemplateResponse } from '@/types';
import { DEBOUNCE_DELAY_MS, DEFAULT_PAGE_SIZE, UNDO_TIMEOUT_MS } from '@/constants';

export default function TransactionListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const observerRef = useRef<HTMLDivElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortValue, setSortValue] = useState('date,desc');
  const [showFilters, setShowFilters] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Debounce keyword search
  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    keywordTimerRef.current = setTimeout(() => setDebouncedKeyword(value), DEBOUNCE_DELAY_MS);
  }, []);

  // Undo
  const { pendingUndo, setPendingUndo, clearUndo } = useUndoStore();
  const [snackOpen, setSnackOpen] = useState(false);

  // Master data
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list(),
    select: (res) => res.data,
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
    select: (res) => res.data,
  });

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.list(),
    select: (res) => res.data.filter((t) => !t.deleted_at),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list(),
    select: (res) => res.data.filter((t) => !t.deleted_at),
    enabled: templateDialogOpen,
  });

  // Infinite query for transactions
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['transactions', { keyword: debouncedKeyword, typeFilter, categoryFilter, accountFilter, dateFrom, dateTo, tagFilter, sortValue }],
    queryFn: ({ pageParam }) =>
      transactionApi.list({
        cursor: pageParam as string | undefined,
        size: DEFAULT_PAGE_SIZE,
        keyword: debouncedKeyword || undefined,
        type: typeFilter || undefined,
        category_id: categoryFilter || undefined,
        account_id: accountFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tag_ids: tagFilter.length > 0 ? tagFilter.join(',') : undefined,
        sort: sortValue,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.pagination;
      return pagination.has_next ? pagination.next_cursor ?? undefined : undefined;
    },
    staleTime: 30_000,
  });

  // Intersection observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    };
  }, []);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      transactionApi.delete(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const handleDelete = (tx: TransactionResponse) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    deleteMutation.mutate({ id: tx.id, version: tx.version });
    setPendingUndo({ type: 'transaction', data: tx, deletedAt: Date.now() });
    setSnackOpen(true);
    undoTimerRef.current = setTimeout(() => {
      clearUndo();
      setSnackOpen(false);
    }, UNDO_TIMEOUT_MS);
  };

  const handleUndo = async () => {
    if (!pendingUndo || pendingUndo.type !== 'transaction') return;
    const tx = pendingUndo.data as TransactionResponse;
    try {
      await transactionApi.restore(tx.id);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {
      setSnackOpen(false);
      // Re-display as error to inform user
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
    clearUndo();
    setSnackOpen(false);
  };

  const handleTemplateSelect = (template: TemplateResponse) => {
    templateApi.use(template.id).catch((err) => {
      console.warn('Failed to record template usage:', err);
    });
    setTemplateDialogOpen(false);
    navigate('/transactions/new', { state: { template } });
  };

  const allTransactions = data?.pages.flatMap((page) => page.data.data) || [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>取引一覧</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<TemplateIcon />}
            onClick={() => setTemplateDialogOpen(true)}
          >
            テンプレートから登録
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/transactions/new')}
          >
            新規取引
          </Button>
        </Stack>
      </Box>

      {/* Search & Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="メモ検索..."
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 200 }}
            />
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon color={showFilters ? 'primary' : 'inherit'} />
            </IconButton>
          </Stack>

          {showFilters && (
            <Stack direction="row" spacing={2} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>種別</InputLabel>
                <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} label="種別">
                  <MenuItem value="">すべて</MenuItem>
                  <MenuItem value="income">収入</MenuItem>
                  <MenuItem value="expense">支出</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>カテゴリ</InputLabel>
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} label="カテゴリ">
                  <MenuItem value="">すべて</MenuItem>
                  {categories?.filter((c) => !c.deleted_at).map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.icon && (
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: c.color || 'grey.300',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mr: 1,
                            flexShrink: 0,
                          }}
                        >
                          <Icon sx={{ color: '#fff', fontSize: 14 }}>{c.icon}</Icon>
                        </Box>
                      )}
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>アカウント</InputLabel>
                <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} label="アカウント">
                  <MenuItem value="">すべて</MenuItem>
                  {accounts?.filter((a) => !a.deleted_at).map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                type="date"
                label="開始日"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                type="date"
                label="終了日"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>タグ</InputLabel>
                <Select
                  multiple
                  value={tagFilter}
                  onChange={(e) => setTagFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                  label="タグ"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((id) => {
                        const tag = tags?.find((t) => t.id === id);
                        return <Chip key={id} size="small" label={tag?.name ?? id} />;
                      })}
                    </Box>
                  )}
                >
                  {tags?.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>ソート</InputLabel>
                <Select value={sortValue} onChange={(e) => setSortValue(e.target.value)} label="ソート">
                  <MenuItem value="date,desc">日付（新しい順）</MenuItem>
                  <MenuItem value="date,asc">日付（古い順）</MenuItem>
                  <MenuItem value="amount,desc">金額（高い順）</MenuItem>
                  <MenuItem value="amount,asc">金額（低い順）</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Transaction Table */}
      {error ? (
        <Alert severity="error">取引の読み込みに失敗しました</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>日時</TableCell>
                <TableCell>種別</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>カテゴリ</TableCell>
                <TableCell>アカウント</TableCell>
                <TableCell>メモ</TableCell>
                <TableCell>タグ</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : allTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">取引がありません</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                allTransactions.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell>{formatDateTime(tx.date)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={tx.type === 'income' ? '収入' : '支出'}
                        color={tx.type === 'income' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.name || '-'}
                    </TableCell>
                    <TableCell>
                      {tx.category ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {tx.category.icon && (
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                bgcolor: tx.category.color || 'grey.300',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Icon sx={{ color: '#fff', fontSize: 16 }}>{tx.category.icon}</Icon>
                            </Box>
                          )}
                          {tx.category.name}
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{tx.account?.name || '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.memo || '-'}
                    </TableCell>
                    <TableCell>
                      {tx.tags.map((tag) => (
                        <Chip
                          key={tag.id}
                          size="small"
                          label={tag.name}
                          sx={{
                            mr: 0.5,
                            mb: 0.5,
                            ...(tag.color ? { bgcolor: tag.color, color: '#fff' } : {}),
                          }}
                        />
                      ))}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 600, color: tx.type === 'income' ? 'success.main' : 'error.main' }}
                    >
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/transactions/${tx.id}/edit`)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(tx)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Infinite scroll sentinel */}
      <Box ref={observerRef} sx={{ py: 2, textAlign: 'center' }}>
        {isFetchingNextPage && <CircularProgress size={24} />}
      </Box>

      {/* Undo Snackbar */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        message="取引を削除しました"
        action={
          <Button color="primary" size="small" onClick={handleUndo}>
            元に戻す
          </Button>
        }
      />

      {/* Template Selection Dialog */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>テンプレートを選択</DialogTitle>
        {!templates ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Box sx={{ px: 3, pb: 3 }}>
            <Typography color="text.secondary">テンプレートがありません</Typography>
          </Box>
        ) : (
          <List sx={{ pt: 0 }}>
            {templates.map((t) => (
              <ListItemButton key={t.id} onClick={() => handleTemplateSelect(t)}>
                <ListItemText
                  primary={t.name}
                  secondary={[
                    t.type === 'income' ? '収入' : '支出',
                    t.amount ? `${formatCurrency(t.amount)}` : null,
                    t.memo,
                  ].filter(Boolean).join(' / ')}
                />
                {t.amount && (
                  <Typography
                    variant="body2"
                    sx={{ ml: 2, fontWeight: 600, color: t.type === 'income' ? 'success.main' : 'error.main', whiteSpace: 'nowrap' }}
                  >
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </Typography>
                )}
              </ListItemButton>
            ))}
          </List>
        )}
      </Dialog>
    </Box>
  );
}
