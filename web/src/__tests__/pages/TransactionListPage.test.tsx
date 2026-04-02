import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import TransactionListPage from '@/pages/Transactions/TransactionListPage';
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
vi.mock('@/api/transactions', () => ({
  transactionApi: {
    list: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock('@/api/categories', () => ({
  categoryApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/api/accounts', () => ({
  accountApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/api/tags', () => ({
  tagApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/api/templates', () => ({
  templateApi: {
    list: vi.fn(),
  },
}));

// react-router-domのモック
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('TransactionListPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // デフォルトのAPIレスポンスを設定
    const { transactionApi } = await import('@/api/transactions');
    const { categoryApi } = await import('@/api/categories');
    const { accountApi } = await import('@/api/accounts');
    const { tagApi } = await import('@/api/tags');
    const { templateApi } = await import('@/api/templates');

    vi.mocked(transactionApi.list).mockResolvedValue(
      mockAxiosResponse({
        data: [],
        pagination: {
          page: 1,
          size: 50,
          total_count: 0,
          total_pages: 0,
        },
      })
    );

    vi.mocked(categoryApi.list).mockResolvedValue(
      mockAxiosResponse([
        { id: 'cat1', name: '食費', type: 'expense', icon: 'restaurant', color: '#FF0000' },
      ])
    );

    vi.mocked(accountApi.list).mockResolvedValue(
      mockAxiosResponse([
        { id: 'acc1', name: '現金', type: 'cash', balance: 10000 },
      ])
    );

    vi.mocked(tagApi.list).mockResolvedValue(mockAxiosResponse([]));
    vi.mocked(templateApi.list).mockResolvedValue(mockAxiosResponse([]));
  });

  it('should render page title', async () => {
    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByText('取引一覧')).toBeInTheDocument();
    });
  });

  it('should render add button', async () => {
    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新規|追加/i })).toBeInTheDocument();
    });
  });

  it('should render search field', async () => {
    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/検索|キーワード/i)).toBeInTheDocument();
    });
  });

  it('should render empty state when no transactions', async () => {
    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByText(/取引がありません|データがありません/i)).toBeInTheDocument();
    });
  });

  it('should render transactions when data exists', async () => {
    const { transactionApi } = await import('@/api/transactions');
    vi.mocked(transactionApi.list).mockResolvedValue(
      mockAxiosResponse({
        data: [
          {
            id: 'tx1',
            type: 'expense',
            amount: 1500,
            currency: 'JPY',
            date: '2024-01-15T12:00:00',
            memo: 'ランチ',
            category_id: 'cat1',
            account_id: 'acc1',
            version: 1,
            created_at: '2024-01-15T12:00:00',
            updated_at: '2024-01-15T12:00:00',
          },
        ],
        pagination: {
          page: 1,
          size: 50,
          total_count: 1,
          total_pages: 1,
        },
      })
    );

    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByText(/¥1,500/)).toBeInTheDocument();
    });
  });

  it('should filter by keyword on input', async () => {
    const user = userEvent.setup();
    const { transactionApi } = await import('@/api/transactions');

    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/検索|キーワード/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/検索|キーワード/i);
    await user.type(searchInput, 'ランチ');

    // デバウンス後にAPIが呼ばれることを確認
    await waitFor(() => {
      expect(transactionApi.list).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('should show filter panel when filter button clicked', async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/フィルター/i)).toBeInTheDocument();
    });

    const filterButton = screen.getByLabelText(/フィルター/i);
    await user.click(filterButton);

    await waitFor(() => {
      // フィルターパネルが表示される
      expect(screen.getByLabelText(/種別|タイプ/i)).toBeInTheDocument();
    });
  });
});
