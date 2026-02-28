import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Grid, ToggleButtonGroup, ToggleButton,
  CircularProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Stack, Card, CardContent, Alert,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';
import { analyticsApi } from '@/api/analytics';
import { formatCurrency, getCurrentYearMonth, getCurrentYear } from '@/utils/format';
import type { CategoryBreakdownItem, MonthlySummaryItem, ComparisonResponse } from '@/types';

const COLORS = ['#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#E91E63', '#8BC34A', '#FF5722', '#607D8B', '#795548', '#CDDC39'];

type ViewMode = 'monthly' | 'yearly' | 'comparison';

export default function AnalysisPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [year, setYear] = useState(getCurrentYear());
  const [compareMonth, setCompareMonth] = useState(getCurrentYearMonth());

  // Monthly view: category breakdowns for expense and income
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

  // Yearly view
  const yearlyQ = useQuery({
    queryKey: ['analytics', 'yearly', year],
    queryFn: () => analyticsApi.yearlySummary(year),
    select: (r) => r.data,
    enabled: viewMode === 'yearly',
  });

  // Comparison view
  const comparisonQ = useQuery({
    queryKey: ['analytics', 'comparison', compareMonth],
    queryFn: () => analyticsApi.comparison(compareMonth),
    select: (r) => r.data,
    enabled: viewMode === 'comparison',
  });

  // Pie chart data
  const expensePieData = useMemo(() => {
    return expenseBreakdownQ.data?.breakdown?.filter((c: CategoryBreakdownItem) => c.amount > 0)
      .map((c: CategoryBreakdownItem) => ({ name: c.category_name, value: c.amount, percentage: c.percentage })) ?? [];
  }, [expenseBreakdownQ.data]);

  const incomePieData = useMemo(() => {
    return incomeBreakdownQ.data?.breakdown?.filter((c: CategoryBreakdownItem) => c.amount > 0)
      .map((c: CategoryBreakdownItem) => ({ name: c.category_name, value: c.amount, percentage: c.percentage })) ?? [];
  }, [incomeBreakdownQ.data]);

  // Bar chart data for yearly monthly trend
  const yearlyBarData = useMemo(() => {
    if (!yearlyQ.data?.monthly) return [];
    return yearlyQ.data.monthly.map((m: MonthlySummaryItem) => {
      const month = m.year_month.split('-')[1];
      return {
        name: `${parseInt(month)}月`,
        収入: m.income,
        支出: m.expense,
        差額: m.balance,
      };
    });
  }, [yearlyQ.data]);

  const fmtTooltip = (v: number | undefined) => v != null ? formatCurrency(v) : '';

  const renderPie = (data: { name: string; value: number; percentage: number }[], title: string, total?: number) => (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      {total != null && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>合計: {formatCurrency(total)}</Typography>}
      {data.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>データがありません</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 2 }}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                label={({ name, percentage }: { name?: string; percentage?: number }) => `${name ?? ''} ${(Number(percentage) || 0).toFixed(1)}%`}>
                {data.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <Box sx={{ minWidth: 180 }}>
            {data.map((d, i) => (
              <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>{d.name}</Typography>
                <Typography variant="body2" fontWeight={600}>{formatCurrency(d.value)}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>分析</Typography>
        <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
          <ToggleButton value="monthly">月次</ToggleButton>
          <ToggleButton value="yearly">年次</ToggleButton>
          <ToggleButton value="comparison">月比較</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ===== MONTHLY VIEW ===== */}
      {viewMode === 'monthly' && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField label="年月" type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          </Stack>
          {(expenseBreakdownQ.isLoading || incomeBreakdownQ.isLoading) ? <CircularProgress /> : (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography variant="body2" color="text.secondary">収入合計</Typography><Typography variant="h5" color="success.main" fontWeight={700}>{formatCurrency(incomeBreakdownQ.data?.total ?? 0)}</Typography></CardContent></Card></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography variant="body2" color="text.secondary">支出合計</Typography><Typography variant="h5" color="error.main" fontWeight={700}>{formatCurrency(expenseBreakdownQ.data?.total ?? 0)}</Typography></CardContent></Card></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography variant="body2" color="text.secondary">収支</Typography><Typography variant="h5" fontWeight={700} color={(incomeBreakdownQ.data?.total ?? 0) - (expenseBreakdownQ.data?.total ?? 0) >= 0 ? 'success.main' : 'error.main'}>{formatCurrency((incomeBreakdownQ.data?.total ?? 0) - (expenseBreakdownQ.data?.total ?? 0))}</Typography></CardContent></Card></Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>{renderPie(expensePieData, '支出内訳', expenseBreakdownQ.data?.total)}</Grid>
                <Grid size={{ xs: 12, md: 6 }}>{renderPie(incomePieData, '収入内訳', incomeBreakdownQ.data?.total)}</Grid>
              </Grid>
            </>
          )}
        </>
      )}

      {/* ===== YEARLY VIEW ===== */}
      {viewMode === 'yearly' && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField label="年" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} size="small" inputProps={{ min: 2000, max: 2100 }} sx={{ width: 120 }} />
          </Stack>
          {yearlyQ.isLoading ? <CircularProgress /> : yearlyQ.error ? <Alert severity="error">データの取得に失敗しました</Alert> : yearlyQ.data && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography variant="body2" color="text.secondary">年間収入</Typography><Typography variant="h5" color="success.main" fontWeight={700}>{formatCurrency(yearlyQ.data.total_income)}</Typography></CardContent></Card></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography variant="body2" color="text.secondary">年間支出</Typography><Typography variant="h5" color="error.main" fontWeight={700}>{formatCurrency(yearlyQ.data.total_expense)}</Typography></CardContent></Card></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography variant="body2" color="text.secondary">年間貯蓄</Typography><Typography variant="h5" fontWeight={700} color={yearlyQ.data.total_savings >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(yearlyQ.data.total_savings)}</Typography></CardContent></Card></Grid>
              </Grid>
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>月別推移</Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={yearlyBarData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                    <Legend />
                    <Bar dataKey="収入" fill="#4CAF50" />
                    <Bar dataKey="支出" fill="#F44336" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>月別収支差額</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={yearlyBarData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                    <Line type="monotone" dataKey="差額" stroke="#2196F3" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </>
          )}
        </>
      )}

      {/* ===== COMPARISON VIEW ===== */}
      {viewMode === 'comparison' && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField label="基準月" type="month" value={compareMonth} onChange={(e) => setCompareMonth(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          </Stack>
          {comparisonQ.isLoading ? <CircularProgress /> : comparisonQ.data && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card><CardContent>
                    <Typography variant="subtitle2" color="text.secondary">当月</Typography>
                    <Typography>収入: {formatCurrency(comparisonQ.data.current.income)} / 支出: {formatCurrency(comparisonQ.data.current.expense)}</Typography>
                    <Typography fontWeight={700} color={comparisonQ.data.current.balance >= 0 ? 'success.main' : 'error.main'}>収支: {formatCurrency(comparisonQ.data.current.balance)}</Typography>
                  </CardContent></Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card><CardContent>
                    <Typography variant="subtitle2" color="text.secondary">前月</Typography>
                    <Typography>収入: {formatCurrency(comparisonQ.data.previous_month.income)} / 支出: {formatCurrency(comparisonQ.data.previous_month.expense)}</Typography>
                    <Typography fontWeight={700} color={comparisonQ.data.previous_month.balance >= 0 ? 'success.main' : 'error.main'}>収支: {formatCurrency(comparisonQ.data.previous_month.balance)}</Typography>
                  </CardContent></Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card><CardContent>
                    <Typography variant="subtitle2" color="text.secondary">前年同月</Typography>
                    <Typography>収入: {formatCurrency(comparisonQ.data.previous_year.income)} / 支出: {formatCurrency(comparisonQ.data.previous_year.expense)}</Typography>
                    <Typography fontWeight={700} color={comparisonQ.data.previous_year.balance >= 0 ? 'success.main' : 'error.main'}>収支: {formatCurrency(comparisonQ.data.previous_year.balance)}</Typography>
                  </CardContent></Card>
                </Grid>
              </Grid>

              {/* MoM Changes Table */}
              <Typography variant="h6" sx={{ mb: 1 }}>前月比カテゴリ増減</Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>カテゴリ</TableCell>
                      <TableCell align="right">当月</TableCell>
                      <TableCell align="right">前月</TableCell>
                      <TableCell align="right">差額</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparisonQ.data.mom_change.category_changes.map((row) => (
                      <TableRow key={row.category_id} hover>
                        <TableCell>{row.category_name}</TableCell>
                        <TableCell align="right">{formatCurrency(row.current_amount)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.previous_amount)}</TableCell>
                        <TableCell align="right" sx={{ color: row.change_amount > 0 ? 'error.main' : row.change_amount < 0 ? 'success.main' : 'text.primary', fontWeight: 600 }}>
                          {row.change_amount > 0 ? '+' : ''}{formatCurrency(row.change_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* YoY Changes Table */}
              <Typography variant="h6" sx={{ mb: 1 }}>前年同月比カテゴリ増減</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>カテゴリ</TableCell>
                      <TableCell align="right">当月</TableCell>
                      <TableCell align="right">前年同月</TableCell>
                      <TableCell align="right">差額</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparisonQ.data.yoy_change.category_changes.map((row) => (
                      <TableRow key={row.category_id} hover>
                        <TableCell>{row.category_name}</TableCell>
                        <TableCell align="right">{formatCurrency(row.current_amount)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.previous_amount)}</TableCell>
                        <TableCell align="right" sx={{ color: row.change_amount > 0 ? 'error.main' : row.change_amount < 0 ? 'success.main' : 'text.primary', fontWeight: 600 }}>
                          {row.change_amount > 0 ? '+' : ''}{formatCurrency(row.change_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </Box>
  );
}
