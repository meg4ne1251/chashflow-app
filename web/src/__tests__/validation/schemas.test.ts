import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  setupSchema,
  transactionSchema,
  transferSchema,
  accountSchema,
  categorySchema,
  budgetSchema,
  recurringTransactionSchema,
} from '@/validation/schemas';

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('loginSchema', () => {
  it('accepts username and password', () => {
    expect(loginSchema.safeParse({ username: 'me', password: 'x' }).success).toBe(true);
  });

  it('rejects empty username', () => {
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false);
  });
});

describe('setupSchema (password policy)', () => {
  const valid = {
    username: 'owner',
    password: 'Abcdef123!@#',
    confirmPassword: 'Abcdef123!@#',
  };

  it('accepts a strong matching password', () => {
    expect(setupSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects password shorter than 12 chars', () => {
    expect(setupSchema.safeParse({ ...valid, password: 'Ab1!', confirmPassword: 'Ab1!' }).success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const r = setupSchema.safeParse({ ...valid, password: 'abcdef123!@#', confirmPassword: 'abcdef123!@#' });
    expect(r.success).toBe(false);
  });

  it('rejects password without a special char', () => {
    const r = setupSchema.safeParse({ ...valid, password: 'Abcdef123456', confirmPassword: 'Abcdef123456' });
    expect(r.success).toBe(false);
  });

  it('rejects when confirmation does not match', () => {
    const r = setupSchema.safeParse({ ...valid, confirmPassword: 'Different123!@#' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
    }
  });
});

describe('transactionSchema', () => {
  const base = { type: 'expense' as const, amount: 1000, date: '2026-05-27' };

  it('accepts a minimal valid transaction', () => {
    expect(transactionSchema.safeParse(base).success).toBe(true);
  });

  it('applies default currency and tag_ids', () => {
    const r = transactionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.currency).toBe('JPY');
      expect(r.data.tag_ids).toEqual([]);
    }
  });

  it('rejects non-positive amount', () => {
    expect(transactionSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
  });

  it('rejects non-integer amount', () => {
    expect(transactionSchema.safeParse({ ...base, amount: 10.5 }).success).toBe(false);
  });

  it('rejects amount over the upper limit', () => {
    expect(transactionSchema.safeParse({ ...base, amount: 10_000_000_000 }).success).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(transactionSchema.safeParse({ ...base, type: 'transfer' }).success).toBe(false);
  });

  it('rejects empty date', () => {
    expect(transactionSchema.safeParse({ ...base, date: '' }).success).toBe(false);
  });

  it('accepts empty-string category_id but rejects malformed UUID', () => {
    expect(transactionSchema.safeParse({ ...base, category_id: '' }).success).toBe(true);
    expect(transactionSchema.safeParse({ ...base, category_id: 'abc' }).success).toBe(false);
  });

  it('rejects memo over 500 chars', () => {
    expect(transactionSchema.safeParse({ ...base, memo: 'a'.repeat(501) }).success).toBe(false);
  });
});

describe('transferSchema', () => {
  const base = { from_account_id: UUID_A, to_account_id: UUID_B, amount: 5000, date: '2026-05-27' };

  it('accepts a transfer between two different accounts', () => {
    expect(transferSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a transfer to the same account', () => {
    const r = transferSchema.safeParse({ ...base, to_account_id: UUID_A });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('to_account_id'))).toBe(true);
    }
  });

  it('rejects missing account ids', () => {
    expect(transferSchema.safeParse({ ...base, from_account_id: '' }).success).toBe(false);
  });
});

describe('accountSchema', () => {
  it('accepts a valid bank account and defaults payment_day to null', () => {
    const r = accountSchema.safeParse({ name: 'メイン口座', type: 'bank' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.payment_day).toBeNull();
      expect(r.data.initial_balance).toBe(0);
    }
  });

  it('coerces empty-string payment_day to null', () => {
    const r = accountSchema.safeParse({ name: 'カード', type: 'credit_card', payment_day: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.payment_day).toBeNull();
  });

  it('accepts a numeric payment_day within range', () => {
    const r = accountSchema.safeParse({ name: 'カード', type: 'credit_card', payment_day: 27 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.payment_day).toBe(27);
  });

  it('rejects payment_day out of range', () => {
    expect(accountSchema.safeParse({ name: 'カード', type: 'credit_card', payment_day: 32 }).success).toBe(false);
    expect(accountSchema.safeParse({ name: 'カード', type: 'credit_card', payment_day: 0 }).success).toBe(false);
  });

  it('rejects an invalid account type', () => {
    expect(accountSchema.safeParse({ name: 'x', type: 'crypto' }).success).toBe(false);
  });
});

describe('categorySchema', () => {
  it('accepts a valid category', () => {
    expect(categorySchema.safeParse({ name: '食費', type: 'expense', color: '#FF0000' }).success).toBe(true);
  });

  it('rejects a malformed color code', () => {
    expect(categorySchema.safeParse({ name: '食費', type: 'expense', color: 'red' }).success).toBe(false);
  });

  it('allows an empty color', () => {
    expect(categorySchema.safeParse({ name: '食費', type: 'expense', color: '' }).success).toBe(true);
  });
});

describe('budgetSchema', () => {
  const base = { category_id: UUID_A, year_month: '2026-05', amount: 30000 };

  it('accepts a valid budget', () => {
    expect(budgetSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a malformed year_month', () => {
    expect(budgetSchema.safeParse({ ...base, year_month: '2026/05' }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...base, year_month: '2026-5' }).success).toBe(false);
  });
});

describe('recurringTransactionSchema', () => {
  const base = {
    type: 'expense' as const,
    amount: 1000,
    category_id: UUID_A,
    account_id: UUID_B,
    frequency: 'monthly' as const,
    start_date: '2026-05-01',
  };

  it('accepts a valid recurring transaction with defaults', () => {
    const r = recurringTransactionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.interval).toBe(1);
      expect(r.data.is_active).toBe(true);
    }
  });

  it('rejects an invalid frequency', () => {
    expect(recurringTransactionSchema.safeParse({ ...base, frequency: 'hourly' }).success).toBe(false);
  });

  it('rejects day_of_week out of range', () => {
    expect(recurringTransactionSchema.safeParse({ ...base, day_of_week: 7 }).success).toBe(false);
  });

  it('rejects missing category_id', () => {
    expect(recurringTransactionSchema.safeParse({ ...base, category_id: '' }).success).toBe(false);
  });
});
