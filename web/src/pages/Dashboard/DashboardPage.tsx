import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalanceWallet,
} from '@mui/icons-material';
import { analyticsApi } from '@/api';
import { formatCurrency, formatDate, formatPercent } from '@/utils/format';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.dashboard(),
    select: (res) => res.data,
    staleTime: 30_000,
  });

  if (error) {
    return <Alert severity="error">ダッシュボードの読み込みに失敗しました</Alert>;
  }

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp color="success" />
                <Typography variant="body2" color="text.secondary">今月の収入</Typography>
              </Box>
              {isLoading ? (
                <Skeleton width="60%" height={40} />
              ) : data && (
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {formatCurrency(data.income_total)}
                </Typography>
              )}
              {data?.month_over_month?.income_change_rate != null && (
                <Typography variant="body2" color="text.secondary">
                  前月比 {formatPercent(data.month_over_month.income_change_rate)}
                  （{formatCurrency(data.month_over_month.income_change)}）
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDown color="error" />
                <Typography variant="body2" color="text.secondary">今月の支出</Typography>
              </Box>
              {isLoading ? (
                <Skeleton width="60%" height={40} />
              ) : data && (
                <Typography variant="h4" fontWeight={700} color="error.main">
                  {formatCurrency(data.expense_total)}
                </Typography>
              )}
              {data?.month_over_month?.expense_change_rate != null && (
                <Typography variant="body2" color="text.secondary">
                  前月比 {formatPercent(data.month_over_month.expense_change_rate)}
                  （{formatCurrency(data.month_over_month.expense_change)}）
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccountBalanceWallet color="primary" />
                <Typography variant="body2" color="text.secondary">収支バランス</Typography>
              </Box>
              {isLoading ? (
                <Skeleton width="60%" height={40} />
              ) : data && (
                <Typography
                  variant="h4"
                  fontWeight={700}
                  color={data.balance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(data.balance)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Budget Consumption TOP3 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>予算消化率 TOP3</Typography>
              {isLoading ? (
                <Box>
                  {[0, 1, 2].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1 }} />)}
                </Box>
              ) : data?.budget_consumption && data.budget_consumption.length > 0 ? (
                data.budget_consumption.slice(0, 3).map((budget) => (
                  <Box key={budget.category_id} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{budget.category_name}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {formatCurrency(budget.spent_amount)} / {formatCurrency(budget.budget_amount)}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${Math.round(budget.consumption_rate)}%`}
                          color={
                            budget.consumption_rate > 100
                              ? 'error'
                              : budget.consumption_rate > 80
                                ? 'warning'
                                : 'default'
                          }
                        />
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(budget.consumption_rate, 100)}
                      color={
                        budget.consumption_rate > 100
                          ? 'error'
                          : budget.consumption_rate > 80
                            ? 'warning'
                            : 'primary'
                      }
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  予算が設定されていません
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>直近の取引</Typography>
              {isLoading ? (
                <Box>
                  {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={40} sx={{ mb: 1 }} />)}
                </Box>
              ) : data?.recent_transactions && data.recent_transactions.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>日付</TableCell>
                        <TableCell>カテゴリ</TableCell>
                        <TableCell>メモ</TableCell>
                        <TableCell align="right">金額</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recent_transactions.slice(0, 10).map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{formatDate(tx.date)}</TableCell>
                          <TableCell>{tx.category?.name || '-'}</TableCell>
                          <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.memo || '-'}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: tx.type === 'income' ? 'success.main' : 'error.main', fontWeight: 600 }}
                          >
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  取引がありません
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
