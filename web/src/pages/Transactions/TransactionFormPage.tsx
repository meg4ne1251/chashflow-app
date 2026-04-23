import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  CircularProgress,
  TextField,
  Box,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { AxiosError } from 'axios';
import dayjs from 'dayjs';
import {
  transactionSchema,
  type TransactionFormData,
} from '@/validation/schemas';
import { zodFormResolver } from '@/validation/resolver';
import { transactionApi } from '@/api/transactions';
import { categoryApi } from '@/api/categories';
import { accountApi } from '@/api/accounts';
import { tagApi } from '@/api/tags';
import { suggestionApi } from '@/api/suggestions';
import { templateApi } from '@/api/templates';
import { getNow } from '@/utils/format';
import { getApiErrorMessage } from '@/types';
import {
  DEBOUNCE_DELAY_MS,
  AUTO_COMPLETE_CONFIDENCE_THRESHOLD,
  MEMO_SUGGESTION_MIN_LENGTH,
} from '@/constants';
import { evaluateExpression, hasOperator } from '@/utils/calc';
import { Icon } from '@/components/Icon';
import { logger } from '@/utils/logger';

type Op = '+' | '-' | '*' | '/';

function parseDatetimeLocal(s: string): { date: string; dow: string } {
  const d = dayjs(s);
  if (!d.isValid()) return { date: '', dow: '' };
  const dowChars = ['日', '月', '火', '水', '木', '金', '土'];
  return {
    date: d.format('YYYY/MM/DD HH:mm'),
    dow: dowChars[d.day()],
  };
}

export default function TransactionFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const templateData = (
    location.state as { template?: import('@/types').TemplateResponse } | null
  )?.template;
  const [memoSuggestions, setMemoSuggestions] = useState<string[]>([]);
  const memoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const [expr, setExpr] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setFocus,
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
  const amountValue = watch('amount');
  const categoryId = watch('category_id');
  const accountId = watch('account_id');
  const dateValue = watch('date');
  const tagIds = watch('tag_ids');
  const memoValue = watch('memo');

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
      setExpr(String(existingTx.amount));
    }
  }, [existingTx, reset]);

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
      if (templateData.amount != null) setExpr(String(templateData.amount));
      setTimeout(() => setFocus('amount'), 0);
    }
  }, [templateData, isEdit, reset, setFocus]);

  const filteredCategories = useMemo(
    () => categories?.filter((c) => c.type === selectedType) || [],
    [categories, selectedType],
  );

  const computedAmount = useMemo(() => {
    if (!expr) return null;
    const r = evaluateExpression(expr);
    return r;
  }, [expr]);

  useEffect(() => {
    if (computedAmount != null && computedAmount > 0) {
      setValue('amount', computedAmount, { shouldValidate: false });
    } else if (!expr) {
      setValue('amount', Number.NaN as unknown as number, {
        shouldValidate: false,
      });
    }
  }, [computedAmount, expr, setValue]);

  const appendDigit = (s: string) => {
    setExpr((prev) => {
      const next = (prev + s).slice(0, 24);
      return next;
    });
  };
  const appendOp = (op: Op) => {
    setExpr((prev) => {
      if (!prev) return op === '-' ? '-' : prev;
      if (/[+\-*/]$/.test(prev)) return prev.slice(0, -1) + op;
      return prev + op;
    });
  };
  const backspace = () => setExpr((prev) => prev.slice(0, -1));
  const equals = () => {
    if (!expr || !hasOperator(expr)) return;
    const r = evaluateExpression(expr);
    if (r != null) setExpr(String(r));
  };

  const handleMemoChange = useCallback(
    (value: string) => {
      setValue('memo', value);
      if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
      if (value.length < MEMO_SUGGESTION_MIN_LENGTH) {
        setMemoSuggestions([]);
        return;
      }
      memoDebounceRef.current = setTimeout(async () => {
        try {
          const res = await suggestionApi.memo(value);
          if (!mountedRef.current) return;
          setMemoSuggestions(res.data.map((s) => s.memo));
        } catch (err) {
          logger.warn('Memo suggestion failed', err);
        }
        try {
          const res = await suggestionApi.autoComplete(value);
          if (!mountedRef.current) return;
          if (
            res.data.category_id &&
            res.data.confidence > AUTO_COMPLETE_CONFIDENCE_THRESHOLD
          ) {
            setValue('category_id', res.data.category_id);
          }
          if (
            res.data.account_id &&
            res.data.confidence > AUTO_COMPLETE_CONFIDENCE_THRESHOLD
          ) {
            setValue('account_id', res.data.account_id);
          }
        } catch (err) {
          logger.warn('Auto-complete failed', err);
        }
      }, DEBOUNCE_DELAY_MS);
    },
    [setValue],
  );

  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      transactionApi.create({
        ...data,
        name: data.name || undefined,
        memo: data.memo || undefined,
        category_id: data.category_id || undefined,
        account_id: data.account_id || undefined,
      }),
    onSuccess: async (_res, data) => {
      if (saveAsTemplate) {
        try {
          await templateApi.create({
            name: data.name || (data.memo ?? '').slice(0, 40) || 'お気に入り',
            type: data.type,
            amount: data.amount,
            category_id: data.category_id || undefined,
            account_id: data.account_id || undefined,
            memo: data.memo || undefined,
            transaction_name: data.name || undefined,
            currency: data.currency,
            tag_ids: data.tag_ids,
          });
          queryClient.invalidateQueries({ queryKey: ['templates'] });
        } catch (err) {
          logger.warn('Failed to save as template', err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/transactions');
    },
    onError: (err: Error) => {
      const msg =
        err instanceof AxiosError
          ? getApiErrorMessage(err.response?.data)
          : null;
      setError(msg || '取引の作成に失敗しました');
    },
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
    onError: (err: Error) => {
      const msg =
        err instanceof AxiosError
          ? getApiErrorMessage(err.response?.data)
          : null;
      setError(msg || '取引の更新に失敗しました');
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

  const close = () => navigate(-1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit(onSubmit)();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSubmit]);

  if (isEdit && loadingTx) {
    return (
      <div className="sheet-overlay">
        <CircularProgress />
      </div>
    );
  }

  const today = dayjs().format('YYYY-MM-DDTHH:mm');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm');
  const { date: dateDisplay, dow: dateDow } = parseDatetimeLocal(dateValue || '');

  const signPrefix = selectedType === 'income' ? '+¥' : '−¥';

  const CALC_KEYS: { k: string; op?: Op; span?: number; cls?: string }[] = [
    { k: '1' },
    { k: '2' },
    { k: '3' },
    { k: '÷', op: '/', cls: 'op' },
    { k: '4' },
    { k: '5' },
    { k: '6' },
    { k: '×', op: '*', cls: 'op' },
    { k: '7' },
    { k: '8' },
    { k: '9' },
    { k: '−', op: '-', cls: 'op' },
    { k: '00' },
    { k: '0' },
    { k: '⌫' },
    { k: '+', op: '+', cls: 'op' },
  ];

  return (
    <div
      className="sheet-overlay"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? '取引の編集' : '取引を追加'}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="sheet-h">
            <h2>{isEdit ? '取引の編集' : '取引を追加'}</h2>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <div className="seg">
                  <button
                    type="button"
                    className={
                      (field.value === 'expense' ? 'active expense' : '')
                    }
                    onClick={() => {
                      field.onChange('expense');
                      setValue('category_id', '');
                    }}
                  >
                    支出
                  </button>
                  <button
                    type="button"
                    className={
                      (field.value === 'income' ? 'active income' : '')
                    }
                    onClick={() => {
                      field.onChange('income');
                      setValue('category_id', '');
                    }}
                  >
                    収入
                  </button>
                  <button
                    type="button"
                    className="transfer"
                    onClick={() => navigate('/transfers/new')}
                    title="振替入力へ"
                  >
                    振替
                  </button>
                </div>
              )}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={close}
              aria-label="閉じる"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {error && (
            <Box sx={{ px: 2, pt: 2 }}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Box>
          )}

          <div className="amount-input">
            <span className="yen-sign">{signPrefix}</span>
            <input
              value={expr}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d+\-*/]/g, '').slice(0, 24);
                setExpr(v);
              }}
              placeholder="0"
              inputMode="decimal"
              aria-label="金額"
            />
          </div>
          {computedAmount != null && hasOperator(expr) && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-3)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                marginTop: -12,
                marginBottom: 4,
              }}
            >
              = ¥{computedAmount.toLocaleString('ja-JP')}
            </div>
          )}
          {errors.amount && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--neg)',
                fontSize: 12,
                marginTop: -8,
                marginBottom: 4,
              }}
            >
              {errors.amount.message}
            </div>
          )}

          <div className="calc-pad">
            {CALC_KEYS.map((b, i) => (
              <button
                type="button"
                key={i}
                className={b.cls || ''}
                onClick={() => {
                  if (b.k === '⌫') backspace();
                  else if (b.op) appendOp(b.op);
                  else appendDigit(b.k);
                }}
              >
                {b.k}
              </button>
            ))}
            <button
              type="button"
              className="op"
              style={{ gridColumn: '1 / span 4' }}
              onClick={equals}
            >
              =
            </button>
          </div>

          <div className="field-list">
            <div className="field">
              <span className="lbl">
                <Icon name="tag" size={12} /> カテゴリ
              </span>
              <div className="val">
                <div className="cat-pick">
                  {filteredCategories.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={categoryId === c.id ? 'on' : ''}
                      onClick={() => setValue('category_id', c.id)}
                    >
                      {c.icon && (
                        <span
                          className="material-icons"
                          style={{
                            fontSize: 14,
                            color: c.color || 'inherit',
                          }}
                          aria-hidden="true"
                        >
                          {c.icon}
                        </span>
                      )}
                      {c.name}
                    </button>
                  ))}
                  {filteredCategories.length === 0 && (
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      利用可能なカテゴリがありません
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="field">
              <span className="lbl">
                <Icon name="card" size={12} /> 決済
              </span>
              <div className="val">
                <div className="cat-pick">
                  {accounts?.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className={accountId === a.id ? 'on' : ''}
                      onClick={() => setValue('account_id', a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <span className="lbl">
                <Icon name="calendar" size={12} /> 日時
              </span>
              <div
                className="val"
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <input
                  type="datetime-local"
                  value={dateValue || ''}
                  onChange={(e) => setValue('date', e.target.value)}
                  aria-label="日時"
                  style={{ minWidth: 180 }}
                />
                {dateDisplay && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-3)',
                    }}
                  >
                    {dateDisplay} ({dateDow})
                  </span>
                )}
                <button
                  type="button"
                  className="filter-pill"
                  onClick={() => setValue('date', today)}
                >
                  今日
                </button>
                <button
                  type="button"
                  className="filter-pill"
                  onClick={() => setValue('date', yesterday)}
                >
                  昨日
                </button>
              </div>
            </div>

            <div className="field">
              <span className="lbl">
                <Icon name="edit" size={12} /> 名前
              </span>
              <div className="val">
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value ?? ''}
                      placeholder="任意 (例: スーパーで買い物)"
                    />
                  )}
                />
              </div>
            </div>

            <div className="field">
              <span className="lbl">
                <Icon name="edit" size={12} /> メモ
              </span>
              <div className="val">
                <Autocomplete
                  freeSolo
                  options={memoSuggestions}
                  inputValue={memoValue || ''}
                  onInputChange={(_e, value) => handleMemoChange(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="standard"
                      placeholder="任意 (例: 同僚と)"
                      InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                      }}
                    />
                  )}
                />
              </div>
            </div>

            <div className="field">
              <span className="lbl">
                <Icon name="folder" size={12} /> タグ
              </span>
              <div className="val">
                <div className="cat-pick">
                  {tags?.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      className={tagIds?.includes(t.id) ? 'on' : ''}
                      onClick={() =>
                        setValue(
                          'tag_ids',
                          tagIds?.includes(t.id)
                            ? tagIds.filter((x) => x !== t.id)
                            : [...(tagIds ?? []), t.id],
                        )
                      }
                    >
                      #{t.name}
                    </button>
                  ))}
                  {!tags?.length && (
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      タグがありません
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="sheet-foot">
            {!isEdit && (
              <label className="save-as">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                よく使う取引として保存
              </label>
            )}
            <button
              type="button"
              className="btn"
              onClick={close}
              disabled={isSubmitting}
              style={isEdit ? { marginLeft: 'auto' } : undefined}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                isSubmitting ||
                updateMutation.isPending ||
                createMutation.isPending ||
                amountValue == null ||
                Number.isNaN(amountValue)
              }
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={14} sx={{ color: 'inherit' }} />
              ) : (
                <Icon name="check" size={14} stroke={2.4} />
              )}
              {isEdit ? '更新' : '登録'} (⌘↵)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
