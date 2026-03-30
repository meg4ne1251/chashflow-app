import type { AccountType, Frequency } from '@/types';

/**
 * Format a number as Japanese Yen currency display
 */
export function formatCurrency(amount: number, currency = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value);
}

/**
 * Format date string to localized display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format datetime string to localized display
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get current year-month as YYYY-MM
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get current year
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Shift a YYYY-MM string by the given number of months (+1 = next, -1 = previous)
 */
export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get current date and time as YYYY-MM-DDTHH:mm (for datetime-local input)
 */
export function getNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Account type labels
 */
export const accountTypeLabels: Record<AccountType, string> = {
  cash: '現金',
  bank: '銀行口座',
  credit_card: 'クレジットカード',
  e_money: '電子マネー',
  other: 'その他',
  savings: '貯蓄口座',
};

/**
 * Frequency labels
 */
export const frequencyLabels: Record<Frequency, string> = {
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
  yearly: '毎年',
};

/**
 * Day of week labels (0=Mon, 6=Sun)
 */
export const dayOfWeekLabels: Record<number, string> = {
  0: '月',
  1: '火',
  2: '水',
  3: '木',
  4: '金',
  5: '土',
  6: '日',
};

/**
 * Download a blob as a file.
 * Properly handles cleanup even if click fails.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error(`ファイルのダウンロードに失敗しました: ${filename}`);
  } finally {
    document.body.removeChild(a);
    // Use queueMicrotask for more reliable cleanup timing
    queueMicrotask(() => URL.revokeObjectURL(url));
  }
}
