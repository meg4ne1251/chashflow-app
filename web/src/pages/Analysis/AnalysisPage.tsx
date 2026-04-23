import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import dayjs from 'dayjs';
import { Icon } from '@/components/Icon';
import { analyticsApi } from '@/api/analytics';
import {
  formatCurrency,
  getCurrentYearMonth,
  getCurrentYear,
  shiftYearMonth,
} from '@/utils/format';
import type { CategoryBreakdownItem, MonthlySummaryItem } from '@/types';
import { CHART_COLORS } from '@/constants';

type ViewMode = 'monthly' | 'yearly' | 'comparison';

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const yenSigned = (n: number) =>
  (n >= 0 ? '+' : '−') + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP');

export default function AnalysisPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [year, setYear] = useState(getCurrentYear());
  const [compareMonth, setCompareMonth] = useState(getCurrentYearMonth());

  const expenseBreakdownQ = useQuery({
    queryKey: ['analytics', 'categoryBreakdown', yearMonth, 'expense'],
    queryFn: () => analyticsApi.categoryBreakdown(yearMonth, 'expense'),
    select: (r) => r.data,
    enabled: viewMode === 'monthly',
  });

  const incomeBreakdownQ = useQuery({
    queryKey: ['analytics', 'categoryBreakdown', yearMonth, 'income'],
    queryFn: () => analyticsApi.categoryBreakdown(yearMonth, 'income'),
    select: (r) => r.data,
    enabled: viewMode === 'monthly',
  });

  const yearlyQ = useQuery({
    queryKey: ['analytics', 'yearly', year],
    queryFn: () => analyticsApi.yearlySummary(year),
    select: (r) => r.data,
    enabled: viewMode === 'yearly',
  });

  const comparisonQ = useQuery({
    queryKey: ['analytics', 'comparison', compareMonth],
    queryFn: () => analyticsApi.comparison(compareMonth),
    select: (r) => r.data,
    enabled: viewMode === 'comparison',
  });

  const expensePieData = useMemo(() => {
    return (
      expenseBreakdownQ.data?.breakdown
        ?.filter((c: CategoryBreakdownItem) => c.amount > 0)
        .map((c: CategoryBreakdownItem) => ({
          name: c.category_name,
          value: c.amount,
          percentage: c.percentage,
        })) ?? []
    );
  }, [expenseBreakdownQ.data]);

  const incomePieData = useMemo(() => {
    return (
      incomeBreakdownQ.data?.breakdown
        ?.filter((c: CategoryBreakdownItem) => c.amount > 0)
        .map((c: CategoryBreakdownItem) => ({
          name: c.category_name,
          value: c.amount,
          percentage: c.percentage,
        })) ?? []
    );
  }, [incomeBreakdownQ.data]);

  const yearlyBarData = useMemo(() => {
    if (!yearlyQ.data?.monthly) return [];
    return yearlyQ.data.monthly.map((m: MonthlySummaryItem) => {
      const month = m.year_month.split('-')[1];
      return {
        name: `${parseInt(month, 10)}月`,
        収入: m.income,
        支出: m.expense,
        差額: m.balance,
      };
    });
  }, [yearlyQ.data]);

  const monthLabel = dayjs(yearMonth + '-01').format('YYYY年M月');

  const renderPieCard = (
    data: { name: string; value: number; percentage: number }[],
    title: string,
    total?: number,
  ) => (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-h">
        <h3>{title}</h3>
        {total != null && (
          <div
            className="mono"
            style={{ fontSize: 13, color: 'var(--text-2)' }}
          >
            合計 {yen(total)}
          </div>
        )}
      </div>
      {data.length === 0 ? (
        <div
          style={{
            color: 'var(--text-3)',
            textAlign: 'center',
            padding: '32px 0',
          }}
        >
          データがありません
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={48}
                paddingAngle={2}
                stroke="var(--bg-1)"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown) => yen(Number(v))}
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 8,
                  color: 'var(--text-1)',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ minWidth: 0 }}>
            {data.map((d, i) => (
              <div
                key={d.name}
                className="donut-legend-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom:
                    i === data.length - 1
                      ? 'none'
                      : '1px solid var(--border-soft)',
                  fontSize: 12.5,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    color: 'var(--text-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.name}
                </span>
                <span
                  className="mono"
                  style={{ color: 'var(--text-1)', fontWeight: 500 }}
                >
                  {yen(d.value)}
                </span>
                <span
                  className="mono dim"
                  style={{ minWidth: 44, textAlign: 'right' }}
                >
                  {d.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const tooltipStyle = {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-soft)',
    borderRadius: 8,
    color: 'var(--text-1)',
    fontSize: 12,
  };

  const monthlyBalance =
    (incomeBreakdownQ.data?.total ?? 0) -
    (expenseBreakdownQ.data?.total ?? 0);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>分析</h1>
          <div className="sub">
            {viewMode === 'monthly' && monthLabel}
            {viewMode === 'yearly' && `${year}年`}
            {viewMode === 'comparison' &&
              `基準 ${dayjs(compareMonth + '-01').format('YYYY年M月')}`}
          </div>
        </div>
        <div className="actions">
          <div className="seg">
            <button
              type="button"
              className={viewMode === 'monthly' ? 'active' : ''}
              onClick={() => setViewMode('monthly')}
            >
              月次
            </button>
            <button
              type="button"
              className={viewMode === 'yearly' ? 'active' : ''}
              onClick={() => setViewMode('yearly')}
            >
              年次
            </button>
            <button
              type="button"
              className={viewMode === 'comparison' ? 'active' : ''}
              onClick={() => setViewMode('comparison')}
            >
              月比較
            </button>
          </div>
        </div>
      </div>

      {/* MONTHLY */}
      {viewMode === 'monthly' && (
        <>
          <div className="toolbar">
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
          </div>

          {expenseBreakdownQ.isLoading || incomeBreakdownQ.isLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
              <CircularProgress size={28} />
            </div>
          ) : expenseBreakdownQ.error || incomeBreakdownQ.error ? (
            <Alert severity="error">データの取得に失敗しました</Alert>
          ) : (
            <>
              <div className="grid-12" style={{ marginBottom: 20 }}>
                <div className="col-4">
                  <div className="card" style={{ padding: 16 }}>
                    <div className="kpi">
                      <div className="kpi-l">収入合計</div>
                      <div
                        className="kpi-v mono"
                        style={{ color: 'var(--pos)' }}
                      >
                        {yen(incomeBreakdownQ.data?.total ?? 0)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="card" style={{ padding: 16 }}>
                    <div className="kpi">
                      <div className="kpi-l">支出合計</div>
                      <div
                        className="kpi-v mono"
                        style={{ color: 'var(--neg)' }}
                      >
                        {yen(expenseBreakdownQ.data?.total ?? 0)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="card" style={{ padding: 16 }}>
                    <div className="kpi">
                      <div className="kpi-l">収支</div>
                      <div
                        className="kpi-v mono"
                        style={{
                          color:
                            monthlyBalance >= 0
                              ? 'var(--pos)'
                              : 'var(--neg)',
                        }}
                      >
                        {yenSigned(monthlyBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid-12">
                <div className="col-6">
                  {renderPieCard(
                    expensePieData,
                    '支出内訳',
                    expenseBreakdownQ.data?.total,
                  )}
                </div>
                <div className="col-6">
                  {renderPieCard(
                    incomePieData,
                    '収入内訳',
                    incomeBreakdownQ.data?.total,
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* YEARLY */}
      {viewMode === 'yearly' && (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="前の年"
              onClick={() => setYear((y) => y - 1)}
            >
              <Icon name="chev-l" size={14} />
            </button>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2000}
              max={2100}
              aria-label="年"
              style={{
                width: 100,
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
              aria-label="次の年"
              onClick={() => setYear((y) => y + 1)}
            >
              <Icon name="chev-r" size={14} />
            </button>
          </div>

          {yearlyQ.isLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
              <CircularProgress size={28} />
            </div>
          ) : yearlyQ.error ? (
            <Alert severity="error">データの取得に失敗しました</Alert>
          ) : (
            yearlyQ.data && (
              <>
                <div className="grid-12" style={{ marginBottom: 20 }}>
                  <div className="col-4">
                    <div className="card" style={{ padding: 16 }}>
                      <div className="kpi">
                        <div className="kpi-l">年間収入</div>
                        <div
                          className="kpi-v mono"
                          style={{ color: 'var(--pos)' }}
                        >
                          {yen(yearlyQ.data.total_income)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="card" style={{ padding: 16 }}>
                      <div className="kpi">
                        <div className="kpi-l">年間支出</div>
                        <div
                          className="kpi-v mono"
                          style={{ color: 'var(--neg)' }}
                        >
                          {yen(yearlyQ.data.total_expense)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="card" style={{ padding: 16 }}>
                      <div className="kpi">
                        <div className="kpi-l">年間貯蓄</div>
                        <div
                          className="kpi-v mono"
                          style={{
                            color:
                              yearlyQ.data.total_savings >= 0
                                ? 'var(--pos)'
                                : 'var(--neg)',
                          }}
                        >
                          {yenSigned(yearlyQ.data.total_savings)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                  <div className="card-h">
                    <h3>月別推移</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={yearlyBarData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border-soft)"
                      />
                      <XAxis
                        dataKey="name"
                        fontSize={11}
                        tick={{ fill: 'var(--text-3)' }}
                      />
                      <YAxis
                        tickFormatter={(v: number) =>
                          `${(v / 1000).toFixed(0)}k`
                        }
                        fontSize={11}
                        width={50}
                        tick={{ fill: 'var(--text-3)' }}
                      />
                      <Tooltip
                        formatter={(v: unknown) => yen(Number(v))}
                        contentStyle={tooltipStyle}
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: 12,
                          color: 'var(--text-2)',
                        }}
                      />
                      <Bar dataKey="収入" fill="var(--pos)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="支出" fill="var(--neg)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <div className="card-h">
                    <h3>月別収支差額</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={yearlyBarData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border-soft)"
                      />
                      <XAxis
                        dataKey="name"
                        fontSize={11}
                        tick={{ fill: 'var(--text-3)' }}
                      />
                      <YAxis
                        tickFormatter={(v: number) =>
                          `${(v / 1000).toFixed(0)}k`
                        }
                        fontSize={11}
                        width={50}
                        tick={{ fill: 'var(--text-3)' }}
                      />
                      <Tooltip
                        formatter={(v: unknown) => yen(Number(v))}
                        contentStyle={tooltipStyle}
                      />
                      <Line
                        type="monotone"
                        dataKey="差額"
                        stroke="var(--info)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'var(--info)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )
          )}
        </>
      )}

      {/* COMPARISON */}
      {viewMode === 'comparison' && (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="前の月"
              onClick={() =>
                setCompareMonth(shiftYearMonth(compareMonth, -1))
              }
            >
              <Icon name="chev-l" size={14} />
            </button>
            <input
              type="month"
              value={compareMonth}
              onChange={(e) => setCompareMonth(e.target.value)}
              aria-label="基準月"
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
              onClick={() =>
                setCompareMonth(shiftYearMonth(compareMonth, 1))
              }
            >
              <Icon name="chev-r" size={14} />
            </button>
          </div>

          {comparisonQ.isLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
              <CircularProgress size={28} />
            </div>
          ) : comparisonQ.error ? (
            <Alert severity="error">データの取得に失敗しました</Alert>
          ) : (
            comparisonQ.data && (
              <>
                <div className="grid-12" style={{ marginBottom: 20 }}>
                  {(
                    [
                      { key: 'current', label: '当月', d: comparisonQ.data.current },
                      {
                        key: 'pm',
                        label: '前月',
                        d: comparisonQ.data.previous_month,
                      },
                      {
                        key: 'py',
                        label: '前年同月',
                        d: comparisonQ.data.previous_year,
                      },
                    ] as const
                  ).map((b) => (
                    <div className="col-4" key={b.key}>
                      <div className="card" style={{ padding: 16 }}>
                        <div className="kpi-l">{b.label}</div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 8,
                            fontSize: 12.5,
                            color: 'var(--text-2)',
                          }}
                        >
                          <span>収入</span>
                          <span className="mono">{yen(b.d.income)}</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 4,
                            fontSize: 12.5,
                            color: 'var(--text-2)',
                          }}
                        >
                          <span>支出</span>
                          <span className="mono">{yen(b.d.expense)}</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: '1px solid var(--border-soft)',
                            fontWeight: 600,
                          }}
                        >
                          <span>収支</span>
                          <span
                            className="mono"
                            style={{
                              color:
                                b.d.balance >= 0
                                  ? 'var(--pos)'
                                  : 'var(--neg)',
                            }}
                          >
                            {yenSigned(b.d.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                  <div className="card-h">
                    <h3>前月比カテゴリ増減</h3>
                  </div>
                  <ChangeTable
                    rows={comparisonQ.data.mom_change.category_changes}
                    prevLabel="前月"
                  />
                </div>

                <div className="card" style={{ padding: 16 }}>
                  <div className="card-h">
                    <h3>前年同月比カテゴリ増減</h3>
                  </div>
                  <ChangeTable
                    rows={comparisonQ.data.yoy_change.category_changes}
                    prevLabel="前年同月"
                  />
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}

interface ChangeRow {
  category_id: string;
  category_name: string;
  current_amount: number;
  previous_amount: number;
  change_amount: number;
}

function ChangeTable({
  rows,
  prevLabel,
}: {
  rows: ChangeRow[];
  prevLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: 'var(--text-3)',
          padding: '24px 0',
          fontSize: 13,
        }}
      >
        差分はありません
      </div>
    );
  }
  return (
    <table
      className="tbl"
      style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}
    >
      <thead>
        <tr
          style={{
            color: 'var(--text-4)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          <th style={{ textAlign: 'left', padding: '8px 8px' }}>カテゴリ</th>
          <th style={{ textAlign: 'right', padding: '8px 8px' }}>当月</th>
          <th style={{ textAlign: 'right', padding: '8px 8px' }}>{prevLabel}</th>
          <th style={{ textAlign: 'right', padding: '8px 8px' }}>差額</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.category_id}
            style={{ borderTop: '1px solid var(--border-soft)' }}
          >
            <td
              style={{
                padding: '10px 8px',
                color: 'var(--text-1)',
                fontSize: 13,
              }}
            >
              {row.category_name}
            </td>
            <td
              className="mono"
              style={{
                padding: '10px 8px',
                textAlign: 'right',
                color: 'var(--text-2)',
                fontSize: 13,
              }}
            >
              {formatCurrency(row.current_amount)}
            </td>
            <td
              className="mono"
              style={{
                padding: '10px 8px',
                textAlign: 'right',
                color: 'var(--text-3)',
                fontSize: 13,
              }}
            >
              {formatCurrency(row.previous_amount)}
            </td>
            <td
              className="mono"
              style={{
                padding: '10px 8px',
                textAlign: 'right',
                fontWeight: 600,
                color:
                  row.change_amount > 0
                    ? 'var(--neg)'
                    : row.change_amount < 0
                      ? 'var(--pos)'
                      : 'var(--text-1)',
              }}
            >
              {row.change_amount > 0 ? '+' : ''}
              {formatCurrency(row.change_amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
