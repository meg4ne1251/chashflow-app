import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from '@tanstack/react-query';
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Button,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Chip,
} from '@mui/material';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import CategoryIcon from '@/components/CategoryIcon';
import { transactionApi } from '@/api/transactions';
import { templateApi } from '@/api/templates';
import { categoryApi } from '@/api/categories';
import { accountApi } from '@/api/accounts';
import { tagApi } from '@/api/tags';
import { formatCurrency } from '@/utils/format';
import { logger } from '@/utils/logger';
import { useUndoStore } from '@/stores/undoStore';
import type {
  TransactionResponse,
  TemplateResponse,
  TransactionType,
} from '@/types';
import {
  DEBOUNCE_DELAY_MS,
  DEFAULT_PAGE_SIZE,
  UNDO_TIMEOUT_MS,
  QUERY_STALE_TIME_MS,
} from '@/constants';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

type TypeFilter = '' | TransactionType;

const TYPE_PILLS: { id: TypeFilter; label: string }[] = [
  { id: '', label: 'すべて' },
  { id: 'expense', label: '支出' },
  { id: 'income', label: '収入' },
];

function formatYenSigned(type: TransactionType, amount: number) {
  const sign = type === 'income' ? '+' : '−';
  return `${sign}¥${Math.abs(Math.round(amount)).toLocaleString('ja-JP')}`;
}

function formatYenSignedSum(sum: number) {
  const sign = sum < 0 ? '−' : '+';
  return `${sign}¥${Math.abs(Math.round(sum)).toLocaleString('ja-JP')}`;
}

export default function TransactionListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const observerRef = useRef<HTMLDivElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortValue, setSortValue] = useState('date,desc');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{
    el: HTMLElement;
    tx: TransactionResponse;
  } | null>(null);

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    keywordTimerRef.current = setTimeout(
      () => setDebouncedKeyword(value),
      DEBOUNCE_DELAY_MS,
    );
  }, []);

  const { pendingUndo, setPendingUndo, clearUndo } = useUndoStore();
  const [snackOpen, setSnackOpen] = useState(false);

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

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list(),
    select: (res) => res.data.filter((t) => !t.deleted_at),
    enabled: templateDialogOpen,
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: [
      'transactions',
      {
        keyword: debouncedKeyword,
        typeFilter,
        categoryFilter,
        accountFilter,
        dateFrom,
        dateTo,
        tagFilter,
        sortValue,
      },
    ],
    queryFn: ({ pageParam }) =>
      transactionApi.list({
        page: pageParam as number,
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
    initialPageParam: 1 as number,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const pagination = lastPage.data.pagination;
      const currentPage = (lastPageParam as number) ?? 1;
      const totalPages = pagination.total_pages ?? 0;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    staleTime: QUERY_STALE_TIME_MS,
  });

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    };
  }, []);

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
    setPendingUndo({
      type: 'transaction',
      data: tx,
      deleted_at: Date.now(),
    });
    setSnackOpen(true);
    undoTimerRef.current = setTimeout(() => {
      clearUndo();
      setSnackOpen(false);
    }, UNDO_TIMEOUT_MS);
  };

  const [undoError, setUndoError] = useState<string | null>(null);

  const handleUndo = async () => {
    if (!pendingUndo || pendingUndo.type !== 'transaction') return;
    const tx = pendingUndo.data as TransactionResponse;
    try {
      await transactionApi.restore(tx.id);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      logger.error('Failed to restore transaction', err, {
        transactionId: tx.id,
      });
      setUndoError('取引の復元に失敗しました');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
    clearUndo();
    setSnackOpen(false);
  };

  const handleTemplateSelect = (template: TemplateResponse) => {
    templateApi.use(template.id).catch((err) => {
      logger.warn('Failed to record template usage', err, {
        templateId: template.id,
      });
    });
    setTemplateDialogOpen(false);
    navigate('/transactions/new', { state: { template } });
  };

  const allTransactions = useMemo(
    () => data?.pages.flatMap((page) => page.data.data) || [],
    [data?.pages],
  );

  const totalCount = data?.pages[0]?.data.pagination.total_count ?? 0;

  const groups = useMemo(() => {
    const m = new Map<string, TransactionResponse[]>();
    for (const t of allTransactions) {
      const key = dayjs(t.date).format('YYYY-MM-DD');
      const arr = m.get(key);
      if (arr) arr.push(t);
      else m.set(key, [t]);
    }
    return Array.from(m.entries());
  }, [allTransactions]);

  const currentMonth = dayjs().format('YYYY年M月');

  return (
    <div>
      {undoError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setUndoError(null)}
        >
          {undoError}
        </Alert>
      )}

      <div className="page-h">
        <div>
          <h1>取引一覧</h1>
          <div className="sub">
            {currentMonth} · 全 {totalCount.toLocaleString('ja-JP')} 件
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => setTemplateDialogOpen(true)}
          >
            <Icon name="bookmark" size={14} />
            テンプレートから
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/transactions/new')}
          >
            <Icon name="plus" size={14} stroke={2.4} />
            新規取引
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-input">
          <Icon
            name="search"
            size={14}
            style={{ color: 'var(--text-3)', flexShrink: 0 }}
          />
          <input
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="名前・メモで検索…"
            aria-label="取引を検索"
          />
        </div>
        {TYPE_PILLS.map((p) => (
          <button
            type="button"
            key={p.id || 'all'}
            className={
              'filter-pill' + (typeFilter === p.id ? ' active' : '')
            }
            onClick={() => setTypeFilter(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={'filter-pill' + (advancedOpen ? ' active' : '')}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <Icon name="filter" size={12} />
          詳細フィルタ
        </button>
      </div>

      {advancedOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            useFlexGap
            flexWrap="wrap"
          >
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={categoryFilter}
                label="カテゴリ"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {categories?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>決済手段</InputLabel>
              <Select
                value={accountFilter}
                label="決済手段"
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <MenuItem value="">すべて</MenuItem>
                {accounts?.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
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
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>タグ</InputLabel>
              <Select
                multiple
                value={tagFilter}
                label="タグ"
                onChange={(e) =>
                  setTagFilter(
                    typeof e.target.value === 'string'
                      ? e.target.value.split(',')
                      : (e.target.value as string[]),
                  )
                }
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((id) => {
                      const tag = tags?.find((t) => t.id === id);
                      return (
                        <Chip
                          key={id}
                          size="small"
                          label={tag?.name ?? id}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {tags?.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>ソート</InputLabel>
              <Select
                value={sortValue}
                label="ソート"
                onChange={(e) => setSortValue(e.target.value)}
              >
                <MenuItem value="date,desc">日付（新しい順）</MenuItem>
                <MenuItem value="date,asc">日付（古い順）</MenuItem>
                <MenuItem value="amount,desc">金額（高い順）</MenuItem>
                <MenuItem value="amount,asc">金額（低い順）</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </div>
      )}

      {error ? (
        <Alert severity="error">取引の読み込みに失敗しました</Alert>
      ) : isLoading ? (
        <div
          style={{ padding: '48px 0', display: 'grid', placeItems: 'center' }}
        >
          <CircularProgress size={28} />
        </div>
      ) : allTransactions.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Typography color="text.secondary">取引がありません</Typography>
        </div>
      ) : (
        <div className="card" style={{ padding: '8px 16px 16px' }}>
          {groups.map(([date, items]) => {
            const d = dayjs(date);
            const total = items.reduce(
              (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
              0,
            );
            return (
              <div className="day-group" key={date}>
                <div className="day-head">
                  <div className="day-l">
                    <span className="day-d">{d.date()}</span>
                    <span className="day-w">
                      ({DOW[d.day()]}) {d.month() + 1}月
                    </span>
                    <span className="muted">{items.length}件</span>
                  </div>
                  <div className="day-t">{formatYenSignedSum(total)}</div>
                </div>
                {items.map((t) => {
                  const isExpense = t.type === 'expense';
                  const name =
                    t.name || t.category?.name || (isExpense ? '支出' : '収入');
                  return (
                    <div
                      className="tx-row"
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate(`/transactions/${t.id}/edit`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/transactions/${t.id}/edit`);
                        }
                      }}
                    >
                      <CategoryIcon
                        icon={t.category?.icon}
                        color={t.category?.color}
                        size={36}
                      />
                      <div className="tx-info">
                        <div className="tx-name">{name}</div>
                        <div className="tx-meta">
                          {t.category && <span>{t.category.name}</span>}
                          {t.category && t.account && (
                            <span className="dot" />
                          )}
                          {t.account && <span>{t.account.name}</span>}
                          {t.memo && <span className="dot" />}
                          {t.memo && <span>{t.memo}</span>}
                          {t.tags.length > 0 && <span className="dot" />}
                          {t.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="tx-tag"
                              style={
                                tag.color
                                  ? {
                                      background: tag.color,
                                      color: 'var(--accent-ink)',
                                    }
                                  : undefined
                              }
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="tx-tag">
                        {isExpense ? '支出' : '収入'}
                      </span>
                      <span
                        className={'tx-amt ' + (isExpense ? 'neg' : 'pos')}
                      >
                        {formatYenSigned(t.type, t.amount)}
                      </span>
                      <div className="tx-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="編集"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/transactions/${t.id}/edit`);
                          }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="メニュー"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRowMenu({ el: e.currentTarget, tx: t });
                          }}
                        >
                          <Icon name="more" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div ref={observerRef} style={{ padding: '16px 0', textAlign: 'center' }}>
        {isFetchingNextPage && <CircularProgress size={20} />}
      </div>

      <Menu
        open={!!rowMenu}
        anchorEl={rowMenu?.el ?? null}
        onClose={() => setRowMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (rowMenu) navigate(`/transactions/${rowMenu.tx.id}/edit`);
            setRowMenu(null);
          }}
        >
          編集
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (rowMenu) handleDelete(rowMenu.tx);
            setRowMenu(null);
          }}
          sx={{ color: 'error.main' }}
        >
          削除
        </MenuItem>
      </Menu>

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
        sx={{ bottom: { xs: 'calc(var(--bottom-tabs-h) + 16px)', sm: 24 } }}
      />

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
            <Typography color="text.secondary">
              テンプレートがありません
            </Typography>
          </Box>
        ) : (
          <List sx={{ pt: 0 }}>
            {templates.map((t) => (
              <ListItemButton
                key={t.id}
                onClick={() => handleTemplateSelect(t)}
              >
                <ListItemText
                  primary={t.name}
                  secondary={[
                    t.type === 'income' ? '収入' : '支出',
                    t.amount ? `${formatCurrency(t.amount)}` : null,
                    t.memo,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                />
                {t.amount && (
                  <Typography
                    variant="body2"
                    sx={{
                      ml: 2,
                      fontWeight: 600,
                      color:
                        t.type === 'income' ? 'success.main' : 'error.main',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </Typography>
                )}
              </ListItemButton>
            ))}
          </List>
        )}
      </Dialog>
    </div>
  );
}
