import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@/test-utils';
import ErrorBoundary from '@/components/ErrorBoundary';

// エラーを投げるコンポーネント
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>正常なコンテンツ</div>;
};

describe('ErrorBoundary', () => {
  // console.errorを抑制
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('正常なコンテンツ')).toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/予期しないエラーが発生しました/i)).toBeInTheDocument();
  });

  it('should show home button in fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /ホームに戻る/i })).toBeInTheDocument();
  });
});
