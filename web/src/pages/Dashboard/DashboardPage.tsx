import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, Alert } from '@mui/material';
import dayjs from 'dayjs';
import { analyticsApi } from '@/api';
import { templateApi } from '@/api/templates';
import { Icon } from '@/components/Icon';
import CategoryIcon from '@/components/CategoryIcon';
import MiniSpark from '@/components/charts/MiniSpark';
import DonutRing from '@/components/charts/DonutRing';
import { logger } from '@/utils/logger';
import type { TemplateResponse, TransactionResponse } from '@/types';
import { QUERY_STALE_TIME_MS } from '@/constants';

const yenFmt = (n: number) => Math.abs(Math.round(n)).toLocaleString('ja-JP');
const yenSigned = (n: number) => (n < 0 ? '−' : '+') + '¥' + yenFmt(n);

/** Aggregate up to 30 days of expense from a recent transaction list. */
function dailyExpenseSeries(transactions: TransactionResponse[]): number[] {
  const today = dayjs().startOf('day');
  const series = new Array(30).fill(0) as number[];
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const d = dayjs(t.date).startOf('day');
    const diff = today.diff(d, 'day');
    if (diff < 0 || diff >= 30) continue;
    series[29 - diff] += t.amount;
  }
  return series;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    staleTime: QUERY_STALE_TIME_MS,
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list(),
    select: (r) => r.data,
    staleTime: 60_000,
  });

  const today = dayjs();
  const daysInMonth = today.daysInMonth();
  const dayProgress = today.date() / daysInMonth;

  const monthBudget = useMemo(
    () => dashboard?.budget_consumption.reduce((s, b) => s + b.budget_amount, 0) ?? 0,
    [dashboard],
  );
  const monthSpent = dashboard?.expense_total ?? 0;
  const monthIncome = dashboard?.income_total ?? 0;
  const balance = dashboard?.balance ?? 0;
  const spentPct = monthBudget > 0 ? monthSpent / monthBudget : 0;
  const onPace = monthBudget * dayProgress;
  const diff = onPace - monthSpent;

  const sparkData = useMemo(
    () => dailyExpenseSeries(dashboard?.recent_transactions ?? []),
    [dashboard],
  );
  const todayIdx = sparkData.length > 0 ? sparkData.length - 1 : 0;

  const quickItems = useMemo(() => {
    return (templates ?? [])
      .filter((t) => t.amount != null)
      .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0))
      .slice(0, 5);
  }, [templates]);

  const handleUseTemplate = (t: TemplateResponse) => {
    templateApi.use(t.id).catch((err) => {
      logger.warn('Failed to record template usage', err, { templateId: t.id });
    });
    navigate('/transactions/new', { state: { template: t } });
  };

  if (error) {
    return <Alert severity="error">ダッシュボードの読み込みに失敗しました</Alert>;
  }

  const incomeChange = dashboard?.month_over_month?.income_change_rate;
  const expenseChange = dashboard?.month_over_month?.expense_change_rate;

  return (
    <>
      {/* Hero */}
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">今月の支出ペース</div>
            <div className={'hero-amt' + (diff < 0 && monthBudget > 0 ? ' neg' : '')}>
              <span className="yen">¥</span>
              {isLoading ? <Skeleton width={180} /> : yenFmt(monthSpent)}
              {monthBudget > 0 && (
                <span
                  style={{
                    fontSize: 16,
                    color: 'var(--text-3)',
                    fontWeight: 400,
                    fontFamily: 'var(--font-sans)',
                    marginLeft: 8,
                  }}
                >
                  / 予算 ¥{yenFmt(monthBudget)}
                </span>
              )}
            </div>
            <div className="hero-sub">
              {monthBudget > 0 ? (
                diff > 0 ? (
                  <span className="chip chip-pos">
                    <Icon name="check" size={11} />
                    ペースより ¥{yenFmt(diff)} 余裕あり
                  </span>
                ) : (
                  <span className="chip chip-warn">ペース超過 ¥{yenFmt(-diff)}</span>
                )
              ) : (
                <span className="chip">予算未設定</span>
              )}
              <span>
                {today.format('M月D日')}時点 · 残り{daysInMonth - today.date()}日
              </span>
            </div>
          </div>
          <div className="hero-tabs" role="tablist">
            {(['day', 'week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={'hero-tab' + (period === p ? ' active' : '')}
                onClick={() => setPeriod(p)}
                role="tab"
                aria-selected={period === p}
              >
                {p === 'day' ? '日' : p === 'week' ? '週' : p === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
        </div>

        {monthBudget > 0 && (
          <div className="pace-wrap">
            <div className="pace-bar">
              <i style={{ width: `${Math.min(spentPct * 100, 100)}%` }} />
              <span
                className="pace-marker"
                data-label="今日"
                style={{ left: `${dayProgress * 100}%` }}
              />
            </div>
            <div className="pace-row" style={{ marginTop: 14 }}>
              <span className="muted">¥0</span>
              <span className="mono dim" style={{ fontSize: 11 }}>
                消化 {Math.round(spentPct * 100)}% · 月進捗 {Math.round(dayProgress * 100)}%
              </span>
              <span className="muted" style={{ textAlign: 'right' }}>
                ¥{yenFmt(monthBudget)}
              </span>
            </div>
          </div>
        )}

        <div className="spark-wrap">
          <MiniSpark data={sparkData} height={48} color="var(--accent)" todayIdx={todayIdx} />
          <div className="spark-axis">
            <span>{today.subtract(29, 'day').format('M/D')}</span>
            <span>{today.subtract(20, 'day').format('M/D')}</span>
            <span>{today.subtract(10, 'day').format('M/D')}</span>
            <span>今日 {today.format('M/D')}</span>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* 3 stat cards */}
      <div className="grid-12">
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label">
                <Icon name="trend-up" size={12} /> 今月の収入
              </div>
              <div className="stat-amt pos mono">+¥{yenFmt(monthIncome)}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {incomeChange != null ? (
                  <>
                    前月比{' '}
                    <span className={incomeChange >= 0 ? 't-up' : 't-down'}>
                      {incomeChange >= 0 ? '+' : ''}
                      {Math.round(incomeChange * 100)}%
                    </span>
                  </>
                ) : (
                  <>前月比 ±0%</>
                )}
              </div>
              <MiniSpark data={[monthIncome > 0 ? monthIncome : 1]} color="var(--pos)" />
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label">
                <Icon name="trend-dn" size={12} /> 今月の支出
              </div>
              <div className="stat-amt neg mono">−¥{yenFmt(monthSpent)}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {expenseChange != null ? (
                  <>
                    前月比{' '}
                    <span className={expenseChange > 0 ? 't-down' : 't-up'}>
                      {expenseChange >= 0 ? '+' : ''}
                      {Math.round(expenseChange * 100)}%
                    </span>
                  </>
                ) : (
                  <>前月比 ±0%</>
                )}
              </div>
              <MiniSpark data={sparkData} color="oklch(0.78 0.13 25)" />
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label">
                <Icon name="yen" size={12} /> 収支バランス
              </div>
              <div className={'stat-amt mono' + (balance < 0 ? ' neg' : '')}>
                {yenSigned(balance)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                月初からの累計
              </div>
              <MiniSpark
                data={sparkData.map((_v, i) => {
                  const ahead = sparkData.slice(0, i + 1).reduce((s, v) => s + v, 0);
                  return Math.max(monthIncome - ahead, 0);
                })}
                color="var(--accent)"
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-12">
        {/* Quick add */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>クイック登録 — タップで即記録</h3>
              <Link className="h-action" to="/templates">
                編集
              </Link>
            </div>
            <div className="dash-quick">
              {quickItems.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="dash-quick-btn"
                  title={`${t.name} を登録`}
                  onClick={() => handleUseTemplate(t)}
                >
                  <CategoryIcon size={28} />
                  <div>
                    <div className="name">{t.name}</div>
                    {t.amount != null && (
                      <div className="amt mono">
                        {t.type === 'income' ? '+' : '−'}¥{yenFmt(t.amount)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              <button
                type="button"
                className="dash-quick-btn"
                onClick={() => navigate('/transactions/new')}
                style={{
                  borderStyle: 'dashed',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'var(--text-3)',
                }}
              >
                <Icon name="plus" size={20} />
                <div className="name" style={{ color: 'var(--text-3)' }}>
                  その他を入力
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Accounts */}
        <div className="col-4">
          <div className="card">
            <div className="card-h">
              <h3>残高 — 決済手段別</h3>
              <Link className="h-action" to="/accounts">
                →
              </Link>
            </div>
            {dashboard?.account_balances?.length ? (
              dashboard.account_balances.map((a) => (
                <div className="acct" key={a.id}>
                  <div className="cat" style={{ background: 'var(--bg-2)' }}>
                    <Icon
                      name={
                        a.type === 'cash'
                          ? 'cash'
                          : a.type === 'bank'
                            ? 'bank'
                            : a.type === 'credit_card'
                              ? 'card'
                              : a.type === 'savings'
                                ? 'piggy'
                                : 'wallet'
                      }
                      size={14}
                    />
                  </div>
                  <div className="meta">
                    <div className="name">{a.name}</div>
                    <div className="sub">
                      {a.type === 'credit_card' && a.payment_day
                        ? `請求 ${a.payment_day}日`
                        : a.type === 'cash'
                          ? '現金'
                          : a.type === 'bank'
                            ? '銀行口座'
                            : a.type === 'savings'
                              ? '貯蓄'
                              : ''}
                    </div>
                  </div>
                  <div className={'bal mono' + (a.balance < 0 ? ' t-down' : '')}>
                    {a.balance < 0 ? '−' : ''}¥{yenFmt(a.balance)}
                  </div>
                </div>
              ))
            ) : (
              <div className="muted" style={{ fontSize: 13, padding: '12px 4px' }}>
                決済手段がありません
              </div>
            )}
          </div>
        </div>

        {/* Budgets */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>予算消化率</h3>
              <Link className="h-action" to="/budgets">
                予算ページへ →
              </Link>
            </div>
            {dashboard?.budget_consumption?.length ? (
              dashboard.budget_consumption.slice(0, 5).map((b) => {
                const pct = b.consumption_rate / 100;
                const cls = pct >= 1 ? 'neg' : pct >= 0.8 ? 'warn' : '';
                const pctCls = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : '';
                return (
                  <div className="bud-row" key={b.category_id}>
                    <div className="bud-line">
                      <span className="lbl">
                        <CategoryIcon size={22} />
                        {b.category_name}
                      </span>
                      <span className="num">
                        ¥{yenFmt(b.spent_amount)} / ¥{yenFmt(b.budget_amount)}
                      </span>
                      <span className={'pct ' + pctCls}>{Math.round(b.consumption_rate)}%</span>
                    </div>
                    <div className={'bar ' + cls}>
                      <i style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                      <span className="pace" style={{ left: `${dayProgress * 100}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="muted" style={{ fontSize: 13, padding: '12px 4px' }}>
                予算が設定されていません
              </div>
            )}
          </div>
        </div>

        {/* Savings */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>貯蓄目標</h3>
              <Link className="h-action" to="/savings-goals">
                すべて見る →
              </Link>
            </div>
            {dashboard?.savings_goals?.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {dashboard.savings_goals.slice(0, 2).map((g) => {
                  const pct = g.progress_rate / 100;
                  const color = g.color ?? 'var(--accent)';
                  return (
                    <div
                      key={g.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: 14,
                        background: 'var(--bg-2)',
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          className="goal-icon"
                          style={
                            {
                              '--goal-color': color,
                              width: 36,
                              height: 36,
                            } as React.CSSProperties
                          }
                        >
                          <Icon name="piggy" size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            期日 {g.deadline ? dayjs(g.deadline).format('YYYY/MM/DD') : '—'}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <DonutRing value={pct} size={64} stroke={7} color={color} />
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                            {Math.round(g.progress_rate)}%
                          </div>
                          <div
                            className="mono"
                            style={{ fontSize: 11, color: 'var(--text-3)' }}
                          >
                            ¥{yenFmt(g.current_amount)}
                            <br />/ ¥{yenFmt(g.target_amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13, padding: '12px 4px' }}>
                貯蓄目標がありません
              </div>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="col-12">
          <div className="card">
            <div className="card-h">
              <h3>直近の取引</h3>
              <Link className="h-action" to="/transactions">
                すべて見る →
              </Link>
            </div>
            <div>
              {isLoading && (
                <>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} height={48} sx={{ my: 0.5 }} />
                  ))}
                </>
              )}
              {!isLoading && dashboard?.recent_transactions?.length ? (
                dashboard.recent_transactions.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    className="tx-row"
                    onClick={() => navigate(`/transactions/${t.id}/edit`)}
                  >
                    <CategoryIcon
                      icon={t.category?.icon}
                      color={t.category?.color}
                      size={36}
                    />
                    <div className="tx-info">
                      <div className="tx-name">
                        {t.name || t.category?.name || (t.type === 'income' ? '収入' : '支出')}
                      </div>
                      <div className="tx-meta">
                        {t.category && <span>{t.category.name}</span>}
                        {t.account && (
                          <>
                            <span className="dot" />
                            <span>{t.account.name}</span>
                          </>
                        )}
                        {t.memo && (
                          <>
                            <span className="dot" />
                            <span className="muted">{t.memo}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="tx-tag">{dayjs(t.date).format('M/D HH:mm')}</span>
                    <span className={'tx-amt ' + (t.type === 'income' ? 'pos' : 'neg')}>
                      {t.type === 'income' ? '+' : '−'}¥{yenFmt(t.amount)}
                    </span>
                    <div className="tx-actions">
                      <button
                        type="button"
                        className="shell-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/transactions/${t.id}/edit`);
                        }}
                        aria-label="編集"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                !isLoading && (
                  <div className="muted" style={{ fontSize: 13, padding: '12px 4px' }}>
                    取引がありません
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
