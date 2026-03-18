package com.kakeibo.shared.model

import kotlinx.serialization.Serializable

// =========================================
// Auth DTOs
// =========================================
@Serializable
data class SetupRequest(val username: String, val password: String)

@Serializable
data class SetupResponse(val user: UserResponse)

@Serializable
data class SetupStatusResponse(val needs_setup: Boolean)

@Serializable
data class UserResponse(val id: String, val username: String)

@Serializable
data class LoginRequest(val username: String, val password: String)

@Serializable
data class LoginResponse(
    val access_token: String,
    val refresh_token: String,
    val expires_in: Int
)

@Serializable
data class RefreshRequest(val refresh_token: String)

@Serializable
data class LogoutRequest(val refresh_token: String)

@Serializable
data class PasswordChangeRequest(
    val current_password: String,
    val new_password: String
)

// =========================================
// Account DTOs
// =========================================
@Serializable
data class AccountRequest(
    val id: String? = null,
    val name: String,
    val type: String,
    val initial_balance: Long = 0,
    val currency: String = "JPY",
    val sort_order: Int = 0,
    val version: Int? = null
)

@Serializable
data class AccountResponse(
    val id: String,
    val name: String,
    val type: String,
    val initial_balance: Long,
    val currency: String,
    val sort_order: Int,
    val balance: Long,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

// =========================================
// Category DTOs
// =========================================
@Serializable
data class CategoryRequest(
    val id: String? = null,
    val name: String,
    val type: String,
    val icon: String? = null,
    val color: String? = null,
    val sort_order: Int = 0,
    val version: Int? = null
)

@Serializable
data class CategoryResponse(
    val id: String,
    val name: String,
    val type: String,
    val icon: String? = null,
    val color: String? = null,
    val sort_order: Int,
    val is_default: Boolean,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

// =========================================
// Tag DTOs
// =========================================
@Serializable
data class TagRequest(
    val id: String? = null,
    val name: String,
    val color: String? = null,
    val version: Int? = null
)

@Serializable
data class TagResponse(
    val id: String,
    val name: String,
    val color: String? = null,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

// =========================================
// Transaction DTOs
// =========================================
@Serializable
data class TransactionRequest(
    val id: String? = null,
    val name: String? = null,
    val type: String,
    val amount: Long,
    val currency: String = "JPY",
    val date: String,
    val memo: String? = null,
    val category_id: String? = null,
    val account_id: String? = null,
    val tag_ids: List<String> = emptyList(),
    val version: Int? = null
)

@Serializable
data class TransactionResponse(
    val id: String,
    val name: String? = null,
    val type: String,
    val amount: Long,
    val currency: String,
    val date: String,
    val memo: String? = null,
    val category_id: String? = null,
    val account_id: String? = null,
    val category: CategoryResponse? = null,
    val account: AccountResponse? = null,
    val tags: List<TagResponse> = emptyList(),
    val is_auto_generated: Boolean,
    val recurring_transaction_id: String? = null,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

@Serializable
data class TransactionHistoryResponse(
    val id: String,
    val transaction_id: String,
    val user_id: String,
    val changed_fields: String,
    val changed_at: String,
    val version_before: Int,
    val version_after: Int
)

// =========================================
// Transfer DTOs
// =========================================
@Serializable
data class TransferRequest(
    val id: String? = null,
    val from_account_id: String,
    val to_account_id: String,
    val amount: Long,
    val currency: String = "JPY",
    val date: String,
    val memo: String? = null,
    val version: Int? = null
)

@Serializable
data class TransferResponse(
    val id: String,
    val from_account_id: String,
    val to_account_id: String,
    val amount: Long,
    val currency: String,
    val date: String,
    val memo: String? = null,
    val from_account: AccountResponse? = null,
    val to_account: AccountResponse? = null,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

// =========================================
// Template DTOs
// =========================================
@Serializable
data class TemplateRequest(
    val id: String? = null,
    val name: String,
    val type: String = "expense",
    val amount: Long? = null,
    val currency: String = "JPY",
    val category_id: String? = null,
    val account_id: String? = null,
    val memo: String? = null,
    val tag_ids: List<String> = emptyList(),
    val version: Int? = null
)

@Serializable
data class TemplateResponse(
    val id: String,
    val name: String,
    val type: String,
    val amount: Long? = null,
    val currency: String,
    val category_id: String? = null,
    val account_id: String? = null,
    val memo: String? = null,
    val tags: List<TagResponse> = emptyList(),
    val use_count: Int,
    val last_used_at: String? = null,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

// =========================================
// Recurring Transaction DTOs
// =========================================
@Serializable
data class RecurringTransactionRequest(
    val id: String? = null,
    val name: String? = null,
    val type: String,
    val amount: Long,
    val currency: String = "JPY",
    val category_id: String,
    val account_id: String,
    val memo: String? = null,
    val frequency: String,
    val interval: Int = 1,
    val day_of_week: Int? = null,
    val day_of_month: Int? = null,
    val month_of_year: Int? = null,
    val start_date: String,
    val end_date: String? = null,
    val tag_ids: List<String> = emptyList(),
    val is_active: Boolean = true,
    val version: Int? = null
)

@Serializable
data class RecurringTransactionResponse(
    val id: String,
    val name: String? = null,
    val type: String,
    val amount: Long,
    val currency: String,
    val category_id: String,
    val account_id: String,
    val memo: String? = null,
    val frequency: String,
    val interval: Int,
    val day_of_week: Int? = null,
    val day_of_month: Int? = null,
    val month_of_year: Int? = null,
    val start_date: String,
    val end_date: String? = null,
    val next_execution_date: String,
    val tags: List<TagResponse> = emptyList(),
    val is_active: Boolean,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

// =========================================
// Budget DTOs
// =========================================
@Serializable
data class BudgetRequest(
    val id: String? = null,
    val category_id: String,
    val year_month: String,
    val amount: Long,
    val currency: String = "JPY",
    val version: Int? = null
)

@Serializable
data class BudgetResponse(
    val id: String,
    val category_id: String,
    val year_month: String,
    val amount: Long,
    val currency: String,
    val spent: Long = 0,
    val consumption_rate: Double = 0.0,
    val category: CategoryResponse? = null,
    val version: Int,
    val created_at: String,
    val updated_at: String,
    val deleted_at: String? = null
)

@Serializable
data class BudgetUpsertRequest(
    val budgets: List<BudgetRequest>
)

// =========================================
// Notification Settings DTOs
// =========================================
@Serializable
data class NotificationSettingRequest(
    val is_enabled: Boolean? = null,
    val frequency: String? = null,
    val day_of_week: String? = null,
    val time_of_day: String? = null,
    val threshold_percent: Int? = null,
    val version: Int? = null
)

@Serializable
data class NotificationSettingResponse(
    val id: String,
    val type: String,
    val is_enabled: Boolean,
    val frequency: String? = null,
    val day_of_week: String? = null,
    val time_of_day: String? = null,
    val threshold_percent: Int? = null,
    val version: Int,
    val created_at: String,
    val updated_at: String
)

// =========================================
// Notification DTOs
// =========================================
@Serializable
data class NotificationResponse(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val is_read: Boolean,
    val created_at: String,
    val read_at: String? = null
)

@Serializable
data class NotificationListResponse(
    val notifications: List<NotificationResponse>,
    val unread_count: Int
)

// =========================================
// Input Pattern DTOs
// =========================================
@Serializable
data class InputPatternResponse(
    val id: String,
    val keyword: String,
    val category_id: String? = null,
    val account_id: String? = null,
    val hit_count: Int,
    val last_used_at: String
)

// =========================================
// Suggestion DTOs
// =========================================
@Serializable
data class MemoSuggestion(
    val memo: String,
    val frequency: Int
)

@Serializable
data class AutoCompleteResponse(
    val category_id: String? = null,
    val account_id: String? = null,
    val confidence: Double = 0.0
)

// =========================================
// Analytics DTOs
// =========================================
@Serializable
data class DashboardResponse(
    val income_total: Long,
    val expense_total: Long,
    val balance: Long,
    val budget_consumption: List<BudgetConsumption>,
    val month_over_month: MonthComparison,
    val recent_transactions: List<TransactionResponse>
)

@Serializable
data class BudgetConsumption(
    val category_id: String,
    val category_name: String,
    val budget_amount: Long,
    val spent_amount: Long,
    val consumption_rate: Double
)

@Serializable
data class MonthComparison(
    val income_change: Long,
    val expense_change: Long,
    val income_change_rate: Double?,
    val expense_change_rate: Double?
)

@Serializable
data class CategoryBreakdownResponse(
    val year_month: String,
    val type: String,
    val total: Long,
    val breakdown: List<CategoryBreakdownItem>
)

@Serializable
data class CategoryBreakdownItem(
    val category_id: String,
    val category_name: String,
    val category_color: String?,
    val amount: Long,
    val percentage: Double
)

@Serializable
data class TrendResponse(
    val from: String,
    val to: String,
    val trends: List<TrendItem>
)

@Serializable
data class TrendItem(
    val year_month: String,
    val categories: List<CategoryTrendItem>
)

@Serializable
data class CategoryTrendItem(
    val category_id: String,
    val category_name: String,
    val income: Long,
    val expense: Long
)

@Serializable
data class ComparisonResponse(
    val year_month: String,
    val current: PeriodSummary,
    val previous_month: PeriodSummary,
    val previous_year: PeriodSummary,
    val mom_change: ComparisonChange,
    val yoy_change: ComparisonChange
)

@Serializable
data class PeriodSummary(
    val income: Long,
    val expense: Long,
    val balance: Long,
    val categories: List<CategorySummaryItem>
)

@Serializable
data class CategorySummaryItem(
    val category_id: String,
    val category_name: String,
    val amount: Long
)

@Serializable
data class ComparisonChange(
    val income_change: Long,
    val expense_change: Long,
    val income_change_rate: Double?,
    val expense_change_rate: Double?,
    val category_changes: List<CategoryChangeItem>
)

@Serializable
data class CategoryChangeItem(
    val category_id: String,
    val category_name: String,
    val current_amount: Long,
    val previous_amount: Long,
    val change_amount: Long,
    val change_rate: Double?
)

@Serializable
data class YearlySummaryResponse(
    val year: Int,
    val total_income: Long,
    val total_expense: Long,
    val total_savings: Long,
    val monthly: List<MonthlySummaryItem>,
    val category_summary: List<CategorySummaryItem>
)

@Serializable
data class MonthlySummaryItem(
    val year_month: String,
    val income: Long,
    val expense: Long,
    val balance: Long
)

// =========================================
// Sync DTOs
// =========================================
@Serializable
data class SyncPushRequest(
    val changes: List<SyncChange>
)

@Serializable
data class SyncChange(
    val entity_type: String,
    val operation: String,
    val data: kotlinx.serialization.json.JsonObject,
    val client_version: Int
)

@Serializable
data class SyncPushResponse(
    val results: List<SyncResult>
)

@Serializable
data class SyncResult(
    val entity_type: String,
    val id: String,
    val status: String,
    val server_version: Int? = null,
    val server_data: kotlinx.serialization.json.JsonObject? = null
)

@Serializable
data class SyncPullResponse(
    val data: SyncData,
    val sync_timestamp: String,
    val has_more: Boolean
)

@Serializable
data class SyncData(
    val transactions: List<TransactionResponse> = emptyList(),
    val categories: List<CategoryResponse> = emptyList(),
    val accounts: List<AccountResponse> = emptyList(),
    val tags: List<TagResponse> = emptyList(),
    val templates: List<TemplateResponse> = emptyList(),
    val recurring_transactions: List<RecurringTransactionResponse> = emptyList(),
    val budgets: List<BudgetResponse> = emptyList(),
    val transfers: List<TransferResponse> = emptyList(),
    val notification_settings: List<NotificationSettingResponse> = emptyList(),
    val input_patterns: List<InputPatternResponse> = emptyList()
)

// =========================================
// Import/Export DTOs
// =========================================
@Serializable
data class ImportPreviewResponse(
    val total_rows: Int,
    val valid_rows: Int,
    val error_rows: Int,
    val preview: List<ImportPreviewRow>,
    val errors: List<ImportError>
)

@Serializable
data class ImportPreviewRow(
    val row_number: Int,
    val date: String?,
    val type: String?,
    val amount: Long?,
    val name: String? = null,
    val category_name: String?,
    val account_name: String?,
    val memo: String?,
    val tags: String?
)

@Serializable
data class ImportError(
    val row_number: Int,
    val field: String?,
    val message: String
)

@Serializable
data class ImportResultResponse(
    val imported_count: Int,
    val skipped_count: Int,
    val errors: List<ImportError>
)

@Serializable
data class BackupData(
    val version: String = "1.0",
    val app_version: String = "1.0.0",
    val created_at: String,
    val device_id: String = "server",
    val schema_version: Int = 1,
    val data: BackupDataContent
)

@Serializable
data class BackupDataContent(
    val accounts: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val categories: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val tags: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val transactions: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val transaction_tags: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val templates: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val template_tags: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val recurring_transactions: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val recurring_transaction_tags: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val budgets: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val transfers: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val notification_settings: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val input_patterns: List<kotlinx.serialization.json.JsonObject> = emptyList(),
    val transaction_history: List<kotlinx.serialization.json.JsonObject> = emptyList()
)

@Serializable
data class RestoreRequest(
    val mode: String // "overwrite" or "merge"
)

// =========================================
// Common Response Wrappers
// =========================================
@Serializable
data class PaginatedResponse<T>(
    val data: List<T>,
    val pagination: PaginationInfo
)

@Serializable
data class PaginationInfo(
    val page: Int? = null,
    val size: Int,
    val total_count: Long? = null,
    val total_pages: Int? = null,
    val has_next: Boolean? = null,
    val next_cursor: String? = null
)

@Serializable
data class ErrorResponse(
    val error: ErrorBody
)

@Serializable
data class ErrorBody(
    val code: String,
    val message: String,
    val details: List<FieldError>? = null,
    val server_data: kotlinx.serialization.json.JsonObject? = null
)

@Serializable
data class FieldError(
    val field: String,
    val message: String
)

// =========================================
// Health Check DTO
// =========================================
@Serializable
data class HealthResponse(
    val status: String,
    val version: String,
    val timestamp: String,
    val checks: HealthChecks
)

@Serializable
data class HealthChecks(
    val database: String
)
