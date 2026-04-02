import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatPercent, getCurrentYearMonth, shiftYearMonth, getToday, getNow } from '@/utils/format';

describe('formatCurrency', () => {
  it('should format positive number with yen symbol', () => {
    const result = formatCurrency(1234);
    // 半角¥（U+00A5）または全角￥（U+FFE5）を許容
    expect(result).toMatch(/^[¥￥]1,234$/);
  });

  it('should format negative number', () => {
    const result = formatCurrency(-5678);
    expect(result).toMatch(/^-[¥￥]5,678$/);
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toMatch(/^[¥￥]0$/);
  });

  it('should format large numbers', () => {
    const result = formatCurrency(1234567890);
    expect(result).toMatch(/^[¥￥]1,234,567,890$/);
  });

  it('should round decimal amounts', () => {
    const result = formatCurrency(1234.56);
    expect(result).toMatch(/^[¥￥]1,235$/);
  });
});

describe('formatNumber', () => {
  it('should format number with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should format zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should format negative numbers', () => {
    expect(formatNumber(-1234)).toBe('-1,234');
  });
});

describe('formatPercent', () => {
  it('should format positive percent with plus sign', () => {
    expect(formatPercent(15)).toBe('+15.0%');
  });

  it('should format negative percent', () => {
    expect(formatPercent(-8)).toBe('-8.0%');
  });

  it('should format zero', () => {
    expect(formatPercent(0)).toBe('+0.0%');
  });

  it('should handle null', () => {
    expect(formatPercent(null)).toBe('-');
  });

  it('should handle undefined', () => {
    expect(formatPercent(undefined)).toBe('-');
  });

  it('should format decimal values', () => {
    expect(formatPercent(12.345)).toBe('+12.3%');
  });
});

describe('getCurrentYearMonth', () => {
  it('should return current year-month in YYYY-MM format', () => {
    const result = getCurrentYearMonth();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('shiftYearMonth', () => {
  it('should shift forward by 1 month', () => {
    expect(shiftYearMonth('2024-06', 1)).toBe('2024-07');
  });

  it('should shift backward by 1 month', () => {
    expect(shiftYearMonth('2024-06', -1)).toBe('2024-05');
  });

  it('should handle year boundary (forward)', () => {
    expect(shiftYearMonth('2024-12', 1)).toBe('2025-01');
  });

  it('should handle year boundary (backward)', () => {
    expect(shiftYearMonth('2024-01', -1)).toBe('2023-12');
  });

  it('should shift by multiple months', () => {
    expect(shiftYearMonth('2024-06', 3)).toBe('2024-09');
    expect(shiftYearMonth('2024-06', -3)).toBe('2024-03');
  });
});

describe('getToday', () => {
  it('should return today in YYYY-MM-DD format', () => {
    const result = getToday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getNow', () => {
  it('should return current datetime in YYYY-MM-DDTHH:mm format', () => {
    const result = getNow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
