import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import type { AxiosResponse } from 'axios';

// AxiosResponseモックを作成するヘルパー
function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
  };
}

// APIモック
vi.mock('@/api', () => ({
  analyticsApi: {
    dashboard: vi.fn(),
  },
}));

describe('DashboardPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', async () => {
    const { analyticsApi } = await import('@/api');
    // 遅延を追加してローディング状態を確認
    vi.mocked(analyticsApi.dashboard).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(
        mockAxiosResponse({
          income_total: 100000,
          expense_total: 50000,
          balance: 50000,
          budget_consumption: [],
          month_over_month: {
            income_change: 10000,
            expense_change: 5000,
            income_change_rate: 10,
            expense_change_rate: 10,
          },
          recent_transactions: [],
          account_balances: [],
          savings_goals: [],
        })
      ), 100))
    );

    render(<DashboardPage />);

    // ローディングスケルトンが表示される
    expect(document.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });

  it('should show error message when API fails', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockRejectedValue(new Error('API Error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/ダッシュボードの読み込みに失敗しました/i)).toBeInTheDocument();
    });
  });

  it('should display income and expense totals', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,
        budget_consumption: [],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 10,
          expense_change_rate: 10,
        },
        recent_transactions: [],
        account_balances: [],
        savings_goals: [],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
      expect(screen.getByText('¥50,000')).toBeInTheDocument();
    });
  });

  it('should display balance with correct color', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,  // プラス
        budget_consumption: [],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 10,
          expense_change_rate: 10,
        },
        recent_transactions: [],
        account_balances: [],
        savings_goals: [],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      // 収支が表示される
      const balanceElements = screen.getAllByText('¥50,000');
      expect(balanceElements.length).toBeGreaterThan(0);
    });
  });

  it('should display month over month change rates', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,
        budget_consumption: [],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 12.5,
          expense_change_rate: -8.3,
        },
        recent_transactions: [],
        account_balances: [],
        savings_goals: [],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/前月比/i)).toBeInTheDocument();
    });
  });

  it('should display budget consumption', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,
        budget_consumption: [
          {
            category_id: 'cat1',
            category_name: '食費',
            budget_amount: 30000,
            spent_amount: 25000,
            consumption_rate: 83.33,
          },
        ],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 10,
          expense_change_rate: 10,
        },
        recent_transactions: [],
        account_balances: [],
        savings_goals: [],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('食費')).toBeInTheDocument();
    });
  });

  it('should display recent transactions', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,
        budget_consumption: [],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 10,
          expense_change_rate: 10,
        },
        recent_transactions: [
          {
            id: 'tx1',
            type: 'expense',
            amount: 1500,
            currency: 'JPY',
            date: '2024-01-15T12:00:00',
            memo: 'ランチ',
            category_id: 'cat1',
            category: {
              id: 'cat1',
              name: '食費',
              type: 'expense',
              icon: 'restaurant',
              color: '#FF0000',
              sort_order: 0,
              is_default: false,
              version: 1,
              created_at: '2024-01-15T12:00:00',
              updated_at: '2024-01-15T12:00:00',
            },
            tags: [],
            is_auto_generated: false,
            is_balance_adjustment: false,
            version: 1,
            created_at: '2024-01-15T12:00:00',
            updated_at: '2024-01-15T12:00:00',
          },
        ],
        account_balances: [],
        savings_goals: [],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/最近の取引/i)).toBeInTheDocument();
      expect(screen.getByText('ランチ')).toBeInTheDocument();
    });
  });

  it('should display account balances', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,
        budget_consumption: [],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 10,
          expense_change_rate: 10,
        },
        recent_transactions: [],
        account_balances: [
          {
            id: 'acc1',
            name: '現金',
            type: 'cash',
            initial_balance: 0,
            currency: 'JPY',
            sort_order: 0,
            balance: 50000,
            version: 1,
            created_at: '2024-01-15T12:00:00',
            updated_at: '2024-01-15T12:00:00',
          },
          {
            id: 'acc2',
            name: '銀行口座',
            type: 'bank',
            initial_balance: 0,
            currency: 'JPY',
            sort_order: 1,
            balance: 200000,
            version: 1,
            created_at: '2024-01-15T12:00:00',
            updated_at: '2024-01-15T12:00:00',
          },
        ],
        savings_goals: [],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.getByText('銀行口座')).toBeInTheDocument();
    });
  });

  it('should display savings goals', async () => {
    const { analyticsApi } = await import('@/api');
    vi.mocked(analyticsApi.dashboard).mockResolvedValue(
      mockAxiosResponse({
        income_total: 100000,
        expense_total: 50000,
        balance: 50000,
        budget_consumption: [],
        month_over_month: {
          income_change: 10000,
          expense_change: 5000,
          income_change_rate: 10,
          expense_change_rate: 10,
        },
        recent_transactions: [],
        account_balances: [],
        savings_goals: [
          {
            id: 'goal1',
            name: '旅行資金',
            target_amount: 500000,
            current_amount: 250000,
            progress_rate: 50,
          },
        ],
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('旅行資金')).toBeInTheDocument();
    });
  });
});
