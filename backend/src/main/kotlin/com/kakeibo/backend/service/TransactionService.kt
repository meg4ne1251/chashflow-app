package com.kakeibo.backend.service

import com.kakeibo.backend.db.Transactions
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.Tags
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.backend.service.CategoryService.Companion.toResponse as categoryToResponse
import com.kakeibo.backend.service.TagService.Companion.toResponse as tagToResponse
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import java.time.LocalDate
import java.util.*

class TransactionService(
    private val transactionRepository: TransactionRepository,
    private val transactionTagRepository: TransactionTagRepository,
    private val transactionHistoryRepository: TransactionHistoryRepository,
    private val inputPatternRepository: InputPatternRepository,
    private val categoryRepository: CategoryRepository,
    private val accountRepository: AccountRepository,
    private val budgetRepository: BudgetRepository,
    private val tagRepository: TagRepository,
    private val analyticsService: AnalyticsService? = null
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    fun getAll(
        dateFrom: String?, dateTo: String?, type: String?,
        categoryId: String?, accountId: String?, tagIds: String?,
        keyword: String?, page: Int?, size: Int, sort: String?
    ): PaginatedResponse<TransactionResponse> {
        val filter = TransactionFilter(
            dateFrom = dateFrom?.let { LocalDate.parse(it) },
            dateTo = dateTo?.let { LocalDate.parse(it) },
            type = type,
            categoryId = categoryId?.let { UUID.fromString(it) },
            accountId = accountId?.let { UUID.fromString(it) },
            tagIds = tagIds?.split(",")?.map { UUID.fromString(it.trim()) },
            keyword = keyword
        )

        val (sortField, sortDir) = parseSort(sort)
        val (rows, total) = transactionRepository.findAll(filter, page ?: 1, size, sortField, sortDir)

        // Batch-load tags to avoid N+1 queries
        val txIds = rows.map { it[Transactions.id] }
        val tagIdsByTx = transactionTagRepository.findByTransactionIds(txIds)
        val allTagIds = tagIdsByTx.values.flatten().distinct()
        val allTags = if (allTagIds.isNotEmpty()) {
            tagRepository.findByIds(allTagIds).associate { it[Tags.id] to it.tagToResponse() }
        } else emptyMap()

        // Batch-load categories and accounts to avoid N+1 queries
        val allCategoryIds = rows.map { it[Transactions.categoryId] }.distinct()
        val categoriesMap = if (allCategoryIds.isNotEmpty()) {
            categoryRepository.findByIds(allCategoryIds).associate { it[Categories.id] to it.categoryToResponse() }
        } else emptyMap()

        val allAccountIds = rows.map { it[Transactions.accountId] }.distinct()
        val accountsMap = if (allAccountIds.isNotEmpty()) {
            accountRepository.findByIds(allAccountIds).associate { row ->
                row[Accounts.id] to AccountResponse(
                    id = row[Accounts.id].toString(),
                    name = row[Accounts.name],
                    type = row[Accounts.type],
                    initial_balance = row[Accounts.initialBalance],
                    currency = row[Accounts.currency],
                    sort_order = row[Accounts.sortOrder],
                    balance = row[Accounts.initialBalance],
                    version = row[Accounts.version],
                    created_at = row[Accounts.createdAt].toString(),
                    updated_at = row[Accounts.updatedAt].toString(),
                    deleted_at = row[Accounts.deletedAt]?.toString()
                )
            }
        } else emptyMap()

        val data = rows.map { row ->
            val txId = row[Transactions.id]
            val txTagIds = tagIdsByTx[txId] ?: emptyList()
            val tags = txTagIds.mapNotNull { allTags[it] }
            val category = categoriesMap[row[Transactions.categoryId]]
            val account = accountsMap[row[Transactions.accountId]]
            row.toResponseWithTags(tags, category, account)
        }

        val currentPage = page ?: 1
        val totalPages = if (total > 0) ((total + size - 1) / size).toInt() else 0

        return PaginatedResponse(
            data = data,
            pagination = PaginationInfo(
                page = currentPage,
                size = size,
                total_count = total,
                total_pages = totalPages
            )
        )
    }

    fun getById(id: String): TransactionResponse {
        val uuid = UUID.fromString(id)
        val row = transactionRepository.findById(uuid)
            ?: throw NotFoundException("取引が見つかりません")
        if (row[Transactions.deletedAt] != null)
            throw NotFoundException("取引が見つかりません")
        return row.toResponse()
    }

    fun create(request: TransactionRequest, userId: String): TransactionResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        val row = transaction {
            val created = transactionRepository.create(
                id = id,
                type = request.type,
                amount = request.amount,
                currency = request.currency,
                date = LocalDate.parse(request.date),
                memo = request.memo?.trim(),
                categoryId = UUID.fromString(request.category_id),
                accountId = UUID.fromString(request.account_id)
            )

            if (request.tag_ids.isNotEmpty()) {
                transactionTagRepository.setTags(id, request.tag_ids.map { UUID.fromString(it) })
            }

            // Update input pattern learning
            request.memo?.takeIf { it.isNotBlank() }?.let { memo ->
                inputPatternRepository.upsert(
                    keyword = memo.trim(),
                    categoryId = UUID.fromString(request.category_id),
                    accountId = UUID.fromString(request.account_id)
                )
            }

            created
        }

        // Invalidate analytics cache for the transaction's month
        invalidateCacheForDate(request.date)

        return row.toResponse()
    }

    fun update(id: String, request: TransactionRequest, userId: String): TransactionResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)
        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val existing = transactionRepository.findById(uuid)
            ?: throw NotFoundException("取引が見つかりません")

        val row = transaction {
            // Record history
            val changedFields = buildChangedFields(existing, request)
            if (changedFields.isNotEmpty()) {
                transactionHistoryRepository.create(
                    transactionId = uuid,
                    userId = UUID.fromString(userId),
                    changedFields = Json.encodeToString(JsonObject.serializer(), changedFields),
                    versionBefore = currentVersion,
                    versionAfter = currentVersion + 1
                )
            }

            val updated = transactionRepository.update(
                id = uuid,
                type = request.type,
                amount = request.amount,
                currency = request.currency,
                date = LocalDate.parse(request.date),
                memo = request.memo?.trim(),
                categoryId = UUID.fromString(request.category_id),
                accountId = UUID.fromString(request.account_id),
                currentVersion = currentVersion
            ) ?: throw ConflictException("バージョン競合が発生しました")

            transactionTagRepository.setTags(uuid, request.tag_ids.map { UUID.fromString(it) })

            updated
        }

        // Invalidate analytics cache for both old and new dates
        invalidateCacheForDate(existing[Transactions.date].toString())
        invalidateCacheForDate(request.date)

        return row.toResponse()
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        val existing = transactionRepository.findById(uuid)
            ?: throw NotFoundException("取引が見つかりません")

        if (!transactionRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
        }

        // Invalidate analytics cache for the deleted transaction's month
        invalidateCacheForDate(existing[Transactions.date].toString())
    }

    fun restore(id: String) {
        val uuid = UUID.fromString(id)
        if (!transactionRepository.restore(uuid)) {
            throw NotFoundException("取引が見つかりません")
        }
    }

    fun getHistory(id: String): List<TransactionHistoryResponse> {
        val uuid = UUID.fromString(id)
        val rows = transactionHistoryRepository.findByTransactionId(uuid)
        return rows.map { row ->
            TransactionHistoryResponse(
                id = row[com.kakeibo.backend.db.TransactionHistory.id].toString(),
                transaction_id = row[com.kakeibo.backend.db.TransactionHistory.transactionId].toString(),
                user_id = row[com.kakeibo.backend.db.TransactionHistory.userId].toString(),
                changed_fields = row[com.kakeibo.backend.db.TransactionHistory.changedFields],
                changed_at = row[com.kakeibo.backend.db.TransactionHistory.changedAt].toString(),
                version_before = row[com.kakeibo.backend.db.TransactionHistory.versionBefore],
                version_after = row[com.kakeibo.backend.db.TransactionHistory.versionAfter]
            )
        }
    }

    private fun buildChangedFields(existing: ResultRow, request: TransactionRequest): JsonObject {
        val changes = mutableMapOf<String, JsonElement>()

        fun addChange(field: String, oldVal: String?, newVal: String?) {
            if (oldVal != newVal) {
                changes[field] = buildJsonObject {
                    put("old", oldVal?.let { JsonPrimitive(it) } ?: JsonNull)
                    put("new", newVal?.let { JsonPrimitive(it) } ?: JsonNull)
                }
            }
        }

        addChange("type", existing[Transactions.type], request.type)
        addChange("amount", existing[Transactions.amount].toString(), request.amount.toString())
        addChange("date", existing[Transactions.date].toString(), request.date)
        addChange("memo", existing[Transactions.memo], request.memo)
        addChange("category_id", existing[Transactions.categoryId].toString(), request.category_id)
        addChange("account_id", existing[Transactions.accountId].toString(), request.account_id)

        return JsonObject(changes)
    }

    /** Single-item response with lazy tag loading (used by getById, create, update) */
    private fun ResultRow.toResponse(): TransactionResponse {
        val txId = this[Transactions.id]

        val tagIds = transactionTagRepository.findByTransactionId(txId)
        val tags = if (tagIds.isNotEmpty()) {
            tagRepository.findByIds(tagIds).map { it.tagToResponse() }
        } else emptyList()

        return toResponseWithTags(tags)
    }

    /** Batch-optimized response with pre-loaded tags, category, and account (used by getAll) */
    private fun ResultRow.toResponseWithTags(
        tags: List<TagResponse>,
        category: CategoryResponse? = null,
        account: AccountResponse? = null
    ): TransactionResponse {
        return TransactionResponse(
            id = this[Transactions.id].toString(),
            type = this[Transactions.type],
            amount = this[Transactions.amount],
            currency = this[Transactions.currency],
            date = this[Transactions.date].toString(),
            memo = this[Transactions.memo],
            category_id = this[Transactions.categoryId].toString(),
            account_id = this[Transactions.accountId].toString(),
            category = category,
            account = account,
            tags = tags,
            is_auto_generated = this[Transactions.isAutoGenerated],
            recurring_transaction_id = this[Transactions.recurringTransactionId]?.toString(),
            version = this[Transactions.version],
            created_at = this[Transactions.createdAt].toString(),
            updated_at = this[Transactions.updatedAt].toString(),
            deleted_at = this[Transactions.deletedAt]?.toString()
        )
    }

    private fun parseSort(sort: String?): Pair<String, String> {
        if (sort == null) return Pair("date", "desc")
        val parts = sort.split(",")
        val field = parts.getOrElse(0) { "date" }
        val dir = parts.getOrElse(1) { "desc" }
        return Pair(field, dir)
    }

    private fun invalidateCacheForDate(dateStr: String) {
        try {
            val date = LocalDate.parse(dateStr)
            val yearMonth = String.format("%04d-%02d", date.year, date.monthValue)
            analyticsService?.invalidateCache(yearMonth)
        } catch (e: Exception) {
            logger.warn("キャッシュ無効化中に日付パースに失敗: $dateStr", e)
            analyticsService?.invalidateAllCache()
        }
    }

    private fun validateRequest(request: TransactionRequest) {
        val errors = mutableListOf<FieldError>()

        if (request.type !in com.kakeibo.shared.model.TransactionType.entries.map { it.value })
            errors.add(FieldError("type", "種別は income または expense を指定してください"))

        ValidationRules.validateAmount(request.amount)?.let {
            errors.add(FieldError("amount", it))
        }

        if (!ValidationRules.validateDate(request.date))
            errors.add(FieldError("date", "日付の形式が不正です（YYYY-MM-DD）"))

        if (!ValidationRules.validateUuid(request.category_id))
            errors.add(FieldError("category_id", "カテゴリIDの形式が不正です"))

        if (!ValidationRules.validateUuid(request.account_id))
            errors.add(FieldError("account_id", "アカウントIDの形式が不正です"))

        request.memo?.let {
            if (it.length > ValidationRules.MEMO_MAX_LENGTH)
                errors.add(FieldError("memo", "メモは${ValidationRules.MEMO_MAX_LENGTH}文字以下で入力してください"))
        }

        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
