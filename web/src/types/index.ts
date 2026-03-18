// =========================================
// Enums
// =========================================
export type TransactionType = 'income' | 'expense';
export type AccountType = 'cash' | 'bank' | 'credit_card' | 'e_money' | 'other';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type NotificationType = 'input_remind' | 'budget_alert';
export type ReminderFrequency = 'daily' | 'weekly' | 'biweekly' | 'custom';
export type SyncOperation = 'create' | 'update' | 'delete';
export type ThemeMode = 'light' | 'dark' | 'system';

// =========================================
// Auth
// =========================================
export interface SetupRequest {
  username: string;
  password: string;
}

export interface SetupResponse {
  user: UserResponse;
}

export interface SetupStatusResponse {
  needs_setup: boolean;
}

export interface UserResponse {
  id: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// =========================================
// Account
// =========================================
export interface AccountRequest {
  id?: string;
  name: string;
  type: AccountType;
  initial_balance?: number;
  currency?: string;
  sort_order?: number;
  version?: number;
}

export interface AccountResponse {
  id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  currency: string;
  sort_order: number;
  balance: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// =========================================
// Category
// =========================================
export interface CategoryRequest {
  id?: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  sort_order?: number;
  version?: number;
}

export interface CategoryResponse {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string | null;
  color?: string | null;
  sort_order: number;
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// =========================================
// Tag
// =========================================
export interface TagRequest {
  id?: string;
  name: string;
  color?: string;
  version?: number;
}

export interface TagResponse {
  id: string;
  name: string;
  color?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// =========================================
// Transaction
// =========================================
export interface TransactionRequest {
  id?: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  date: string;
  memo?: string;
  category_id?: string;
  account_id?: string;
  tag_ids?: string[];
  version?: number;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  memo?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  category?: CategoryResponse | null;
  account?: AccountResponse | null;
  tags: TagResponse[];
  is_auto_generated: boolean;
  recurring_transaction_id?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface TransactionHistoryResponse {
  id: string;
  transaction_id: string;
  user_id: string;
  changed_fields: string;
  changed_at: string;
  version_before: number;
  version_after: number;
}

// =========================================
// Transfer
// =========================================
export interface TransferRequest {
  id?: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency?: string;
  date: string;
  memo?: string;
  version?: number;
}

export interface TransferResponse {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: string;
  date: string;
  memo?: string | null;
  from_account?: AccountResponse | null;
  to_account?: AccountResponse | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// =========================================
// Template
// =========================================
export interface TemplateRequest {
  id?: string;
  name: string;
  type?: TransactionType;
  amount?: number;
  currency?: string;
  category_id?: string;
  account_id?: string;
  memo?: string;
  tag_ids?: string[];
  version?: number;
}

export interface TemplateResponse {
  id: string;
  name: string;
  type: TransactionType;
  amount?: number | null;
  currency: string;
  category_id?: string | null;
  account_id?: string | null;
  memo?: string | null;
  tags: TagResponse[];
  use_count: number;
  last_used_at?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// =========================================
// Recurring Transaction
// =========================================
export interface RecurringTransactionRequest {
  id?: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  category_id: string;
  account_id: string;
  memo?: string;
  frequency: Frequency;
  interval?: number;
  day_of_week?: number;
  day_of_month?: number;
  month_of_year?: number;
  start_date: string;
  end_date?: string;
  tag_ids?: string[];
  is_active?: boolean;
  version?: number;
}

export interface RecurringTransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category_id: string;
  account_id: string;
  memo?: string | null;
  frequency: Frequency;
  interval: number;
  day_of_week?: number | null;
  day_of_month?: number | null;
  month_of_year?: number | null;
  start_date: string;
  end_date?: string | null;
  next_execution_date: string;
  tags: TagResponse[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// =========================================
// Budget
// =========================================
export interface BudgetRequest {
  id?: string;
  category_id: string;
  year_month: string;
  amount: number;
  currency?: string;
  version?: number;
}

export interface BudgetResponse {
  id: string;
  category_id: string;
  year_month: string;
  amount: number;
  currency: string;
  spent: number;
  consumption_rate: number;
  category?: CategoryResponse | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BudgetUpsertRequest {
  budgets: BudgetRequest[];
}

// =========================================
// Notification Settings
// =========================================
export interface NotificationSettingRequest {
  is_enabled?: boolean;
  frequency?: ReminderFrequency;
  day_of_week?: string;
  time_of_day?: string;
  threshold_percent?: number;
  version?: number;
}

export interface NotificationSettingResponse {
  id: string;
  type: NotificationType;
  is_enabled: boolean;
  frequency?: ReminderFrequency | null;
  day_of_week?: string | null;
  time_of_day?: string | null;
  threshold_percent?: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// =========================================
// Suggestion
// =========================================
export interface MemoSuggestion {
  memo: string;
  frequency: number;
}

export interface AutoCompleteResponse {
  category_id?: string | null;
  account_id?: string | null;
  confidence: number;
}

// =========================================
// Analytics
// =========================================
export interface DashboardResponse {
  income_total: number;
  expense_total: number;
  balance: number;
  budget_consumption: BudgetConsumption[];
  month_over_month: MonthComparison;
  recent_transactions: TransactionResponse[];
}

export interface BudgetConsumption {
  category_id: string;
  category_name: string;
  budget_amount: number;
  spent_amount: number;
  consumption_rate: number;
}

export interface MonthComparison {
  income_change: number;
  expense_change: number;
  income_change_rate?: number | null;
  expense_change_rate?: number | null;
}

export interface CategoryBreakdownResponse {
  year_month: string;
  type: TransactionType;
  total: number;
  breakdown: CategoryBreakdownItem[];
}

export interface CategoryBreakdownItem {
  category_id: string;
  category_name: string;
  category_color?: string | null;
  amount: number;
  percentage: number;
}

export interface TrendResponse {
  from: string;
  to: string;
  trends: TrendItem[];
}

export interface TrendItem {
  year_month: string;
  categories: CategoryTrendItem[];
}

export interface CategoryTrendItem {
  category_id: string;
  category_name: string;
  income: number;
  expense: number;
}

export interface ComparisonResponse {
  year_month: string;
  current: PeriodSummary;
  previous_month: PeriodSummary;
  previous_year: PeriodSummary;
  mom_change: ComparisonChange;
  yoy_change: ComparisonChange;
}

export interface PeriodSummary {
  income: number;
  expense: number;
  balance: number;
  categories: CategorySummaryItem[];
}

export interface CategorySummaryItem {
  category_id: string;
  category_name: string;
  amount: number;
}

export interface ComparisonChange {
  income_change: number;
  expense_change: number;
  income_change_rate?: number | null;
  expense_change_rate?: number | null;
  category_changes: CategoryChangeItem[];
}

export interface CategoryChangeItem {
  category_id: string;
  category_name: string;
  current_amount: number;
  previous_amount: number;
  change_amount: number;
  change_rate?: number | null;
}

export interface YearlySummaryResponse {
  year: number;
  total_income: number;
  total_expense: number;
  total_savings: number;
  monthly: MonthlySummaryItem[];
  category_summary: CategorySummaryItem[];
}

export interface MonthlySummaryItem {
  year_month: string;
  income: number;
  expense: number;
  balance: number;
}

// =========================================
// Import/Export
// =========================================
export interface ImportPreviewResponse {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  preview: ImportPreviewRow[];
  errors: ImportError[];
}

export interface ImportPreviewRow {
  row_number: number;
  date?: string | null;
  type?: string | null;
  amount?: number | null;
  category_name?: string | null;
  account_name?: string | null;
  memo?: string | null;
  tags?: string | null;
}

export interface ImportError {
  row_number: number;
  field?: string | null;
  message: string;
}

export interface ImportResultResponse {
  imported_count: number;
  skipped_count: number;
  errors: ImportError[];
}

// =========================================
// Backup
// =========================================
export interface RestoreRequest {
  mode: 'overwrite' | 'merge';
}

// =========================================
// Pagination
// =========================================
export interface PaginationInfo {
  page?: number;
  size: number;
  total_count?: number;
  total_pages?: number;
  has_next?: boolean;
  next_cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// =========================================
// Error
// =========================================
export interface ErrorResponse {
  error: ErrorBody;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: FieldError[];
  server_data?: Record<string, unknown>;
}

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Type guard for API error responses.
 * Safely extracts an error message from an unknown AxiosError response payload.
 */
export function getApiErrorMessage(data: unknown): string | null {
  if (
    data != null &&
    typeof data === 'object' &&
    'error' in data &&
    data.error != null &&
    typeof data.error === 'object' &&
    'message' in data.error &&
    typeof data.error.message === 'string'
  ) {
    return data.error.message;
  }
  return null;
}

// =========================================
// Health
// =========================================
export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  checks: { database: string };
}
