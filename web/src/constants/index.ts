// =========================================
// UI timing constants
// =========================================

/** Undo snackbar display duration in ms */
export const UNDO_TIMEOUT_MS = 5_000;

/** Debounce delay for search/input in ms */
export const DEBOUNCE_DELAY_MS = 300;

/** Default page size for paginated lists */
export const DEFAULT_PAGE_SIZE = 50;

/** Minimum confidence threshold for auto-complete suggestions */
export const AUTO_COMPLETE_CONFIDENCE_THRESHOLD = 0.5;

/** Minimum character length to trigger memo suggestions */
export const MEMO_SUGGESTION_MIN_LENGTH = 2;

// =========================================
// Default categories (must match backend seed data / shared Constants.kt)
// =========================================

/** Fallback expense category ID from seed data ("その他支出") */
export const FALLBACK_EXPENSE_CATEGORY_ID = 'a0000000-0000-0000-0000-00000000000d';

/** Fallback income category ID from seed data ("その他収入") */
export const FALLBACK_INCOME_CATEGORY_ID = 'b0000000-0000-0000-0000-000000000005';

// =========================================
// Form defaults
// =========================================

/**
 * Empty initial value for numeric form fields.
 * react-hook-form requires a typed default, but number inputs should start blank.
 * Using this constant avoids scattered `as unknown as number` casts.
 */
export const EMPTY_NUMBER = undefined as unknown as number;

// =========================================
// Chart colors
// =========================================

/** Standard color palette for charts (category breakdowns, pie charts, etc.) */
export const CHART_COLORS = [
  '#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0',
  '#00BCD4', '#E91E63', '#8BC34A', '#FF5722', '#607D8B',
  '#795548', '#CDDC39',
] as const;
