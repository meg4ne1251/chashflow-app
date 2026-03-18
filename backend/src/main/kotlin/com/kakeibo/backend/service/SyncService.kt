package com.kakeibo.backend.service

import com.kakeibo.backend.db.*
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.*

class SyncService(
    private val transactionRepository: TransactionRepository,
    private val categoryRepository: CategoryRepository,
    private val accountRepository: AccountRepository,
    private val tagRepository: TagRepository,
    private val templateRepository: TemplateRepository,
    private val recurringTransactionRepository: RecurringTransactionRepository,
    private val budgetRepository: BudgetRepository,
    private val transferRepository: TransferRepository,
    private val notificationSettingRepository: NotificationSettingRepository,
    private val inputPatternRepository: InputPatternRepository
) {
    companion object {
        private const val MAX_BATCH_SIZE = 100
        private const val PULL_LIMIT = 1000
    }

    fun push(request: SyncPushRequest): SyncPushResponse {
        if (request.changes.size > MAX_BATCH_SIZE) {
            throw ValidationException(
                "一度に送信可能な変更は${MAX_BATCH_SIZE}件までです",
                listOf(FieldError("changes", "最大${MAX_BATCH_SIZE}件"))
            )
        }

        val results = mutableListOf<SyncResult>()
        for (change in request.changes) {
            val result = try {
                processChange(change)
            } catch (e: ConflictException) {
                SyncResult(
                    entity_type = change.entity_type,
                    id = change.data["id"]?.jsonPrimitive?.contentOrNull ?: "",
                    status = "conflict",
                    server_version = null,
                    server_data = null
                )
            } catch (e: Exception) {
                SyncResult(
                    entity_type = change.entity_type,
                    id = change.data["id"]?.jsonPrimitive?.contentOrNull ?: "",
                    status = "error",
                    server_version = null,
                    server_data = null
                )
            }
            results.add(result)
        }

        return SyncPushResponse(results = results)
    }

    fun pull(since: String): SyncPullResponse {
        val sinceTime = OffsetDateTime.parse(since)
        val now = OffsetDateTime.now()

        val transactions = transactionRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val categories = categoryRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val accounts = accountRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val tags = tagRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val templates = templateRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val recurringTransactions = recurringTransactionRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val budgets = budgetRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val transfers = transferRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val notificationSettings = notificationSettingRepository.findUpdatedSince(sinceTime, PULL_LIMIT)
        val inputPatterns = inputPatternRepository.findUpdatedSince(sinceTime, PULL_LIMIT)

        val totalCount = transactions.size + categories.size + accounts.size +
                tags.size + templates.size + recurringTransactions.size +
                budgets.size + transfers.size + notificationSettings.size +
                inputPatterns.size

        return SyncPullResponse(
            data = SyncData(
                transactions = transactions.map { it.toTransactionResponse() },
                categories = categories.map { it.toCategoryResponse() },
                accounts = accounts.map { it.toAccountResponse() },
                tags = tags.map { it.toTagResponse() },
                templates = templates.map { it.toTemplateResponse() },
                recurring_transactions = recurringTransactions.map { it.toRecurringTransactionResponse() },
                budgets = budgets.map { it.toBudgetResponse() },
                transfers = transfers.map { it.toTransferResponse() },
                notification_settings = notificationSettings.map { it.toNotificationSettingResponse() },
                input_patterns = inputPatterns.map { it.toInputPatternResponse() }
            ),
            sync_timestamp = now.toString(),
            has_more = totalCount >= PULL_LIMIT
        )
    }

    private fun processChange(change: SyncChange): SyncResult {
        val id = change.data["id"]?.jsonPrimitive?.contentOrNull
            ?: throw ValidationException("IDが必要です", listOf(FieldError("id", "IDは必須です")))

        val uuid = UUID.fromString(id)
        val version = change.client_version

        return when (change.operation) {
            "create", "update" -> {
                transaction {
                    when (change.entity_type) {
                        "transaction" -> {
                            val existing = transactionRepository.findById(uuid)
                            if (existing != null && change.operation == "create") {
                                throw ConflictException("既に存在します")
                            }
                            val name = change.data.optionalString("name")
                            val type = change.data.requireString("type")
                            val amount = change.data.requireLong("amount")
                            val currency = change.data.optionalString("currency") ?: "JPY"
                            val date = LocalDateTime.parse(change.data.requireString("date"))
                            val memo = change.data.optionalString("memo")
                            val categoryId = UUID.fromString(change.data.requireString("category_id"))
                            // account_id is optional (V4 migration made it nullable)
                            val accountId = change.data.optionalString("account_id")?.let { UUID.fromString(it) }

                            if (change.operation == "update" && existing != null) {
                                val serverVersion = existing[Transactions.version]
                                if (serverVersion != version) throw ConflictException("バージョン競合")
                                transactionRepository.update(
                                    id = uuid, type = type, amount = amount, currency = currency,
                                    date = date, memo = memo, categoryId = categoryId,
                                    accountId = accountId, currentVersion = version,
                                    name = name
                                )
                            } else {
                                transactionRepository.create(
                                    id = uuid, type = type, amount = amount, currency = currency,
                                    date = date, memo = memo, categoryId = categoryId, accountId = accountId,
                                    name = name
                                )
                            }
                        }
                        "category" -> {
                            val existing = categoryRepository.findById(uuid)
                            val name = change.data.requireString("name")
                            val type = change.data.requireString("type")
                            val icon = change.data.optionalString("icon")
                            val color = change.data.optionalString("color")
                            val sortOrder = change.data.optionalInt("sort_order") ?: 0

                            if (change.operation == "update" && existing != null) {
                                val serverVersion = existing[Categories.version]
                                if (serverVersion != version) throw ConflictException("バージョン競合")
                                categoryRepository.update(
                                    id = uuid, name = name, type = type, icon = icon,
                                    color = color, sortOrder = sortOrder, currentVersion = version
                                )
                            } else {
                                categoryRepository.create(
                                    id = uuid, name = name, type = type, icon = icon,
                                    color = color, sortOrder = sortOrder
                                )
                            }
                        }
                        "account" -> {
                            val existing = accountRepository.findById(uuid)
                            val name = change.data.requireString("name")
                            val type = change.data.requireString("type")
                            val initialBalance = change.data.optionalLong("initial_balance") ?: 0L
                            val currency = change.data.optionalString("currency") ?: "JPY"
                            val sortOrder = change.data.optionalInt("sort_order") ?: 0

                            if (change.operation == "update" && existing != null) {
                                val serverVersion = existing[Accounts.version]
                                if (serverVersion != version) throw ConflictException("バージョン競合")
                                accountRepository.update(
                                    id = uuid, name = name, type = type, initialBalance = initialBalance,
                                    currency = currency, sortOrder = sortOrder, currentVersion = version
                                )
                            } else {
                                accountRepository.create(
                                    id = uuid, name = name, type = type, initialBalance = initialBalance,
                                    currency = currency, sortOrder = sortOrder
                                )
                            }
                        }
                        "tag" -> {
                            val existing = tagRepository.findById(uuid)
                            val name = change.data.requireString("name")
                            val color = change.data.optionalString("color")

                            if (change.operation == "update" && existing != null) {
                                val serverVersion = existing[Tags.version]
                                if (serverVersion != version) throw ConflictException("バージョン競合")
                                tagRepository.update(
                                    id = uuid, name = name, color = color, currentVersion = version
                                )
                            } else {
                                tagRepository.create(id = uuid, name = name, color = color)
                            }
                        }
                        else -> throw ValidationException(
                            "未対応のエンティティ種別です: ${change.entity_type}",
                            listOf(FieldError("entity_type", "transaction, category, account, tag のいずれかを指定してください"))
                        )
                    }
                }
                SyncResult(
                    entity_type = change.entity_type,
                    id = id,
                    status = "accepted",
                    server_version = version + 1,
                    server_data = null
                )
            }
            "delete" -> {
                transaction {
                    when (change.entity_type) {
                        "transaction" -> transactionRepository.softDelete(uuid, version)
                        "category" -> categoryRepository.softDelete(uuid, version)
                        "account" -> accountRepository.softDelete(uuid, version)
                        "tag" -> tagRepository.softDelete(uuid, version)
                        "template" -> templateRepository.softDelete(uuid, version)
                        "recurring_transaction" -> recurringTransactionRepository.softDelete(uuid, version)
                        "budget" -> budgetRepository.softDelete(uuid, version)
                        "transfer" -> transferRepository.softDelete(uuid, version)
                    }
                }
                SyncResult(
                    entity_type = change.entity_type,
                    id = id,
                    status = "accepted",
                    server_version = version + 1,
                    server_data = null
                )
            }
            else -> throw ValidationException(
                "不正なオペレーション",
                listOf(FieldError("operation", "create, update, delete のいずれかを指定してください"))
            )
        }
    }

    // ===== Response Mappers =====

    private fun ResultRow.toTransactionResponse() = TransactionResponse(
        id = this[Transactions.id].toString(),
        type = this[Transactions.type],
        amount = this[Transactions.amount],
        currency = this[Transactions.currency],
        date = this[Transactions.date].toString(),
        memo = this[Transactions.memo],
        category_id = this[Transactions.categoryId].toString(),
        account_id = this[Transactions.accountId]?.toString(),
        tags = emptyList(),
        is_auto_generated = this[Transactions.isAutoGenerated],
        recurring_transaction_id = this[Transactions.recurringTransactionId]?.toString(),
        version = this[Transactions.version],
        created_at = this[Transactions.createdAt].toString(),
        updated_at = this[Transactions.updatedAt].toString(),
        deleted_at = this[Transactions.deletedAt]?.toString()
    )

    private fun ResultRow.toCategoryResponse() = CategoryResponse(
        id = this[Categories.id].toString(),
        name = this[Categories.name],
        type = this[Categories.type],
        icon = this[Categories.icon],
        color = this[Categories.color],
        sort_order = this[Categories.sortOrder],
        is_default = this[Categories.isDefault],
        version = this[Categories.version],
        created_at = this[Categories.createdAt].toString(),
        updated_at = this[Categories.updatedAt].toString(),
        deleted_at = this[Categories.deletedAt]?.toString()
    )

    private fun ResultRow.toAccountResponse() = AccountResponse(
        id = this[Accounts.id].toString(),
        name = this[Accounts.name],
        type = this[Accounts.type],
        initial_balance = this[Accounts.initialBalance],
        currency = this[Accounts.currency],
        sort_order = this[Accounts.sortOrder],
        balance = this[Accounts.initialBalance], // simplified for sync
        version = this[Accounts.version],
        created_at = this[Accounts.createdAt].toString(),
        updated_at = this[Accounts.updatedAt].toString(),
        deleted_at = this[Accounts.deletedAt]?.toString()
    )

    private fun ResultRow.toTagResponse() = TagResponse(
        id = this[Tags.id].toString(),
        name = this[Tags.name],
        color = this[Tags.color],
        version = this[Tags.version],
        created_at = this[Tags.createdAt].toString(),
        updated_at = this[Tags.updatedAt].toString(),
        deleted_at = this[Tags.deletedAt]?.toString()
    )

    private fun ResultRow.toTemplateResponse() = TemplateResponse(
        id = this[Templates.id].toString(),
        name = this[Templates.name],
        type = this[Templates.type],
        amount = this[Templates.amount],
        currency = this[Templates.currency],
        category_id = this[Templates.categoryId]?.toString(),
        account_id = this[Templates.accountId]?.toString(),
        memo = this[Templates.memo],
        tags = emptyList(),
        use_count = this[Templates.useCount],
        last_used_at = this[Templates.lastUsedAt]?.toString(),
        version = this[Templates.version],
        created_at = this[Templates.createdAt].toString(),
        updated_at = this[Templates.updatedAt].toString(),
        deleted_at = this[Templates.deletedAt]?.toString()
    )

    private fun ResultRow.toRecurringTransactionResponse() = RecurringTransactionResponse(
        id = this[RecurringTransactions.id].toString(),
        type = this[RecurringTransactions.type],
        amount = this[RecurringTransactions.amount],
        currency = this[RecurringTransactions.currency],
        category_id = this[RecurringTransactions.categoryId].toString(),
        account_id = this[RecurringTransactions.accountId].toString(),
        memo = this[RecurringTransactions.memo],
        frequency = this[RecurringTransactions.frequency],
        interval = this[RecurringTransactions.interval],
        day_of_week = this[RecurringTransactions.dayOfWeek],
        day_of_month = this[RecurringTransactions.dayOfMonth],
        month_of_year = this[RecurringTransactions.monthOfYear],
        start_date = this[RecurringTransactions.startDate].toString(),
        end_date = this[RecurringTransactions.endDate]?.toString(),
        next_execution_date = this[RecurringTransactions.nextExecutionDate].toString(),
        tags = emptyList(),
        is_active = this[RecurringTransactions.isActive],
        version = this[RecurringTransactions.version],
        created_at = this[RecurringTransactions.createdAt].toString(),
        updated_at = this[RecurringTransactions.updatedAt].toString(),
        deleted_at = this[RecurringTransactions.deletedAt]?.toString()
    )

    private fun ResultRow.toBudgetResponse() = BudgetResponse(
        id = this[Budgets.id].toString(),
        category_id = this[Budgets.categoryId].toString(),
        year_month = this[Budgets.yearMonth],
        amount = this[Budgets.amount],
        currency = this[Budgets.currency],
        version = this[Budgets.version],
        created_at = this[Budgets.createdAt].toString(),
        updated_at = this[Budgets.updatedAt].toString(),
        deleted_at = this[Budgets.deletedAt]?.toString()
    )

    private fun ResultRow.toTransferResponse() = TransferResponse(
        id = this[Transfers.id].toString(),
        from_account_id = this[Transfers.fromAccountId].toString(),
        to_account_id = this[Transfers.toAccountId].toString(),
        amount = this[Transfers.amount],
        currency = this[Transfers.currency],
        date = this[Transfers.date].toString(),
        memo = this[Transfers.memo],
        version = this[Transfers.version],
        created_at = this[Transfers.createdAt].toString(),
        updated_at = this[Transfers.updatedAt].toString(),
        deleted_at = this[Transfers.deletedAt]?.toString()
    )

    private fun ResultRow.toNotificationSettingResponse() = NotificationSettingResponse(
        id = this[NotificationSettings.id].toString(),
        type = this[NotificationSettings.type],
        is_enabled = this[NotificationSettings.isEnabled],
        frequency = this[NotificationSettings.frequency],
        day_of_week = this[NotificationSettings.dayOfWeek],
        time_of_day = this[NotificationSettings.timeOfDay]?.toString(),
        threshold_percent = this[NotificationSettings.thresholdPercent],
        version = this[NotificationSettings.version],
        created_at = this[NotificationSettings.createdAt].toString(),
        updated_at = this[NotificationSettings.updatedAt].toString()
    )

    private fun ResultRow.toInputPatternResponse() = InputPatternResponse(
        id = this[InputPatterns.id].toString(),
        keyword = this[InputPatterns.keyword],
        category_id = this[InputPatterns.categoryId]?.toString(),
        account_id = this[InputPatterns.accountId]?.toString(),
        hit_count = this[InputPatterns.hitCount],
        last_used_at = this[InputPatterns.lastUsedAt].toString()
    )

    // ===== Safe JSON Field Access Helpers =====

    private fun Map<String, kotlinx.serialization.json.JsonElement>.requireString(field: String): String =
        this[field]?.jsonPrimitive?.contentOrNull
            ?: throw ValidationException("${field}は必須です", listOf(FieldError(field, "${field}は必須です")))

    private fun Map<String, kotlinx.serialization.json.JsonElement>.requireLong(field: String): Long =
        this[field]?.jsonPrimitive?.longOrNull
            ?: throw ValidationException("${field}は必須です", listOf(FieldError(field, "${field}は数値で指定してください")))

    private fun Map<String, kotlinx.serialization.json.JsonElement>.optionalString(field: String): String? =
        this[field]?.jsonPrimitive?.contentOrNull

    private fun Map<String, kotlinx.serialization.json.JsonElement>.optionalInt(field: String): Int? =
        this[field]?.jsonPrimitive?.intOrNull

    private fun Map<String, kotlinx.serialization.json.JsonElement>.optionalLong(field: String): Long? =
        this[field]?.jsonPrimitive?.longOrNull
}
