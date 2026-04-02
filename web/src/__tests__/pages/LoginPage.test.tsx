import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/pages/Login/LoginPage';
import { useAuthStore } from '@/stores/authStore';

// react-router-domのモック
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      username: null,
    });
  });

  it('should render login form', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/ユーザー名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument();
  });

  it('should show validation error for empty username', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // パスワードだけ入力
    await user.type(screen.getByLabelText(/パスワード/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /ログイン/i }));

    await waitFor(() => {
      expect(screen.getByText(/ユーザー名を入力してください/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty password', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // ユーザー名だけ入力
    await user.type(screen.getByLabelText(/ユーザー名/i), 'testuser');
    await user.click(screen.getByRole('button', { name: /ログイン/i }));

    await waitFor(() => {
      expect(screen.getByText(/パスワードを入力してください/i)).toBeInTheDocument();
    });
  });

  it('should call login on valid submit', async () => {
    const loginMock = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ login: loginMock });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/ユーザー名/i), 'testuser');
    await user.type(screen.getByLabelText(/パスワード/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /ログイン/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('testuser', 'Password1');
    });
  });

  it('should show link to setup page', () => {
    render(<LoginPage />);

    expect(screen.getByText(/初期セットアップ/i)).toBeInTheDocument();
  });

  it('should show title', () => {
    render(<LoginPage />);

    expect(screen.getByText('家計簿')).toBeInTheDocument();
  });
});
