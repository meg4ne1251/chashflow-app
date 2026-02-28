import { z } from 'zod';

// Password: 8+ chars, at least 1 uppercase, 1 lowercase, 1 digit
const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .regex(/[A-Z]/, '英大文字を1文字以上含めてください')
  .regex(/[a-z]/, '英小文字を1文字以上含めてください')
  .regex(/[0-9]/, '数字を1文字以上含めてください');

export const loginSchema = z.object({
  username: z.string().min(1, 'ユーザー名を入力してください').max(50),
  password: z.string().min(1, 'パスワードを入力してください'),
});

export const setupSchema = z.object({
  username: z.string().min(1, 'ユーザー名を入力してください').max(50),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'パスワード（確認）を入力してください'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, '現在のパスワードを入力してください'),
  new_password: passwordSchema,
  confirm_password: z.string().min(1, 'パスワード（確認）を入力してください'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'パスワードが一致しません',
  path: ['confirm_password'],
});

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z
    .number({ error: '金額を入力してください' })
    .int('整数で入力してください')
    .positive('金額は0より大きい値を指定してください')
    .max(9_999_999_999, '金額が上限を超えています'),
  date: z.string().min(1, '日付を入力してください'),
  category_id: z.string().uuid('カテゴリを選択してください'),
  account_id: z.string().uuid('アカウントを選択してください'),
  memo: z.string().max(500, 'メモは500文字以下です').optional().or(z.literal('')),
  currency: z.string().default('JPY'),
  tag_ids: z.array(z.string()).default([]),
});

export const transferSchema = z.object({
  from_account_id: z.string().uuid('出金元アカウントを選択してください'),
  to_account_id: z.string().uuid('入金先アカウントを選択してください'),
  amount: z
    .number({ error: '金額を入力してください' })
    .int('整数で入力してください')
    .positive('金額は0より大きい値を指定してください')
    .max(9_999_999_999, '金額が上限を超えています'),
  date: z.string().min(1, '日付を入力してください'),
  memo: z.string().max(500).optional().or(z.literal('')),
  currency: z.string().default('JPY'),
}).refine((data) => data.from_account_id !== data.to_account_id, {
  message: '出金元と入金先は異なるアカウントを選択してください',
  path: ['to_account_id'],
});

export const accountSchema = z.object({
  name: z.string().min(1, 'アカウント名を入力してください').max(50),
  type: z.enum(['cash', 'bank', 'credit_card', 'e_money', 'other']),
  initial_balance: z.number().int('整数で入力してください').default(0),
  currency: z.string().default('JPY'),
  sort_order: z.number().int().default(0),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'カテゴリ名を入力してください').max(50),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(50).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '色は#RRGGBB形式で入力してください').optional().or(z.literal('')),
  sort_order: z.number().int().default(0),
});

export const tagSchema = z.object({
  name: z.string().min(1, 'タグ名を入力してください').max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '色は#RRGGBB形式で入力してください').optional().or(z.literal('')),
});

export const templateSchema = z.object({
  name: z.string().min(1, 'テンプレート名を入力してください').max(50),
  type: z.enum(['income', 'expense']).default('expense'),
  amount: z.number().int().positive().max(9_999_999_999).optional().nullable(),
  currency: z.string().default('JPY'),
  category_id: z.string().uuid().optional().nullable().or(z.literal('')),
  account_id: z.string().uuid().optional().nullable().or(z.literal('')),
  memo: z.string().max(500).optional().or(z.literal('')),
  tag_ids: z.array(z.string()).default([]),
});

export const budgetSchema = z.object({
  category_id: z.string().uuid('カテゴリを選択してください'),
  year_month: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM形式で入力してください'),
  amount: z
    .number({ error: '予算額を入力してください' })
    .int('整数で入力してください')
    .positive('予算額は0より大きい値を指定してください')
    .max(9_999_999_999),
  currency: z.string().default('JPY'),
});

export const recurringTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z
    .number({ error: '金額を入力してください' })
    .int('整数で入力してください')
    .positive('金額は0より大きい値を指定してください')
    .max(9_999_999_999),
  currency: z.string().default('JPY'),
  category_id: z.string().uuid('カテゴリを選択してください'),
  account_id: z.string().uuid('アカウントを選択してください'),
  memo: z.string().max(500).optional().or(z.literal('')),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).default(1),
  day_of_week: z.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.number().int().min(1).max(31).optional().nullable(),
  month_of_year: z.number().int().min(1).max(12).optional().nullable(),
  start_date: z.string().min(1, '開始日を入力してください'),
  end_date: z.string().optional().or(z.literal('')),
  tag_ids: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SetupFormData = z.infer<typeof setupSchema>;
export type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;
export type TransactionFormData = z.infer<typeof transactionSchema>;
export type TransferFormData = z.infer<typeof transferSchema>;
export type AccountFormData = z.infer<typeof accountSchema>;
export type CategoryFormData = z.infer<typeof categorySchema>;
export type TagFormData = z.infer<typeof tagSchema>;
export type TemplateFormData = z.infer<typeof templateSchema>;
export type BudgetFormData = z.infer<typeof budgetSchema>;
export type RecurringTransactionFormData = z.infer<typeof recurringTransactionSchema>;
