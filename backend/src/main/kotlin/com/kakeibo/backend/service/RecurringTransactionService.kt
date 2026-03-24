package com.kakeibo.backend.service

import com.kakeibo.backend.db.RecurringTransactions
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.backend.service.TagService.Companion.toResponse as tagToResponse
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters
import java.util.*

class RecurringTransactionService(
    private val recurringTransactionRepository: RecurringTransactionRepository,
    private val recurringTransactionTagRepository: RecurringTransactionTagRepository,
    private val transactionRepository: TransactionRepository,
    private val transactionTagRepository: TransactionTagRepository,
    private val tagRepository: TagRepository
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    fun getAll(): List<RecurringTransactionResponse> {
        return recurringTransactionRepository.findAll().map { it.toResponse() }
    }

    fun create(request: RecurringTransactionRequest): RecurringTransactionResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()
        val startDate = LocalDate.parse(request.start_date)
        val nextExec = calculateNextExecutionDate(
            frequency = request.frequency,
            interval = request.interval,
            dayOfWeek = request.day_of_week,
            dayOfMonth = request.day_of_month,
            monthOfYear = request.month_of_year,
            fromDate = startDate
        )

        val row = transaction {
            val created = recurringTransactionRepository.create(
                id = id, type = request.type, amount = request.amount,
                currency = request.currency,
                categoryId = UUID.fromString(request.category_id),
                accountId = UUID.fromString(request.account_id),
                memo = request.memo?.trim(),
                name = request.name?.trim(),
                frequency = request.frequency, interval = request.interval,
                dayOfWeek = request.day_of_week, dayOfMonth = request.day_of_month,
                monthOfYear = request.month_of_year,
                startDate = startDate, endDate = request.end_date?.let { LocalDate.parse(it) },
                nextExecutionDate = nextExec, isActive = request.is_active
            )

            if (request.tag_ids.isNotEmpty()) {
                recurringTransactionTagRepository.setTags(id, request.tag_ids.map { UUID.fromString(it) })
            }
            created
        }
        return row.toResponse()
    }

    fun update(id: String, request: RecurringTransactionRequest): RecurringTransactionResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)
        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val startDate = LocalDate.parse(request.start_date)
        val nextExec = calculateNextExecutionDate(
            frequency = request.frequency,
            interval = request.interval,
            dayOfWeek = request.day_of_week,
            dayOfMonth = request.day_of_month,
            monthOfYear = request.month_of_year,
            fromDate = startDate
        )

        val row = transaction {
            val updated = recurringTransactionRepository.update(
                id = uuid, type = request.type, amount = request.amount,
                currency = request.currency,
                categoryId = UUID.fromString(request.category_id),
                accountId = UUID.fromString(request.account_id),
                memo = request.memo?.trim(),
                name = request.name?.trim(),
                frequency = request.frequency, interval = request.interval,
                dayOfWeek = request.day_of_week, dayOfMonth = request.day_of_month,
                monthOfYear = request.month_of_year,
                startDate = startDate, endDate = request.end_date?.let { LocalDate.parse(it) },
                nextExecutionDate = nextExec, isActive = request.is_active,
                currentVersion = currentVersion
            ) ?: throw ConflictException("バージョン競合が発生しました")

            recurringTransactionTagRepository.setTags(uuid, request.tag_ids.map { UUID.fromString(it) })
            updated
        }
        return row.toResponse()
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        recurringTransactionRepository.findById(uuid)
            ?: throw NotFoundException("定期取引が見つかりません")
        if (!recurringTransactionRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
        }
    }

    fun toggle(id: String): RecurringTransactionResponse {
        val uuid = UUID.fromString(id)
        val row = recurringTransactionRepository.toggleActive(uuid)
            ?: throw NotFoundException("定期取引が見つかりません")
        return row.toResponse()
    }

    /**
     * Execute due recurring transactions.
     * Called by the scheduler daily.
     */
    fun executeDueTransactions(date: LocalDate = LocalDate.now()): Int {
        var created = 0
        val due = recurringTransactionRepository.findDueForExecution(date)

        for (row in due) {
            try {
                transaction {
                    val rtId = row[RecurringTransactions.id]
                    val txId = UUID.randomUUID()

                    transactionRepository.create(
                        id = txId,
                        type = row[RecurringTransactions.type],
                        amount = row[RecurringTransactions.amount],
                        currency = row[RecurringTransactions.currency],
                        date = row[RecurringTransactions.nextExecutionDate].atStartOfDay(),
                        memo = row[RecurringTransactions.memo],
                        categoryId = row[RecurringTransactions.categoryId],
                        accountId = row[RecurringTransactions.accountId],
                        isAutoGenerated = true,
                        recurringTransactionId = rtId,
                        name = row[RecurringTransactions.name]
                    )

                    // Copy tags
                    val tagIds = recurringTransactionTagRepository.findByRecurringTransactionId(rtId)
                    if (tagIds.isNotEmpty()) {
                        transactionTagRepository.setTags(txId, tagIds)
                    }

                    // Calculate and update next execution date
                    // Use the current execution date (not +1) as the base;
                    // each frequency handler already advances past fromDate.
                    val nextDate = calculateNextExecutionDate(
                        frequency = row[RecurringTransactions.frequency],
                        interval = row[RecurringTransactions.interval],
                        dayOfWeek = row[RecurringTransactions.dayOfWeek],
                        dayOfMonth = row[RecurringTransactions.dayOfMonth],
                        monthOfYear = row[RecurringTransactions.monthOfYear],
                        fromDate = row[RecurringTransactions.nextExecutionDate]
                    )
                    recurringTransactionRepository.updateNextExecutionDate(rtId, nextDate)
                    created++
                }
            } catch (e: Exception) {
                logger.error("定期取引の自動生成に失敗: ${row[RecurringTransactions.id]}", e)
            }
        }

        if (created > 0) {
            logger.info("定期取引から${created}件の取引を自動生成しました")
        }
        return created
    }

    fun calculateNextExecutionDate(
        frequency: String, interval: Int,
        dayOfWeek: Int?, dayOfMonth: Int?, monthOfYear: Int?,
        fromDate: LocalDate
    ): LocalDate {
        return when (frequency) {
            "daily" -> fromDate.plusDays(interval.toLong())
            "weekly" -> {
                val targetDow = dayOfWeek?.let { convertDayOfWeek(it) } ?: fromDate.dayOfWeek
                var next = fromDate.with(TemporalAdjusters.nextOrSame(targetDow))
                if (next == fromDate) next = next.plusWeeks(interval.toLong())
                // If next is still same, advance
                if (!next.isAfter(fromDate)) next = next.plusWeeks(interval.toLong())
                next
            }
            "monthly" -> {
                val targetDay = dayOfMonth ?: fromDate.dayOfMonth
                var next = fromDate
                repeat(interval) {
                    next = next.plusMonths(1)
                }
                val yearMonth = YearMonth.of(next.year, next.month)
                val adjustedDay = minOf(targetDay, yearMonth.lengthOfMonth())
                LocalDate.of(next.year, next.month, adjustedDay)
            }
            "yearly" -> {
                val targetMonth = monthOfYear ?: fromDate.monthValue
                val targetDay = dayOfMonth ?: fromDate.dayOfMonth
                var next = fromDate.plusYears(interval.toLong())
                val yearMonth = YearMonth.of(next.year, targetMonth)
                val adjustedDay = minOf(targetDay, yearMonth.lengthOfMonth())
                LocalDate.of(next.year, targetMonth, adjustedDay)
            }
            else -> throw IllegalArgumentException("不正な頻度です: $frequency")
        }
    }

    private fun convertDayOfWeek(dow: Int): DayOfWeek {
        // 0=Monday..6=Sunday (as per requirements)
        return DayOfWeek.of(dow + 1) // DayOfWeek: 1=MONDAY..7=SUNDAY
    }

    private fun ResultRow.toResponse(): RecurringTransactionResponse {
        val rtId = this[RecurringTransactions.id]
        val tagIds = recurringTransactionTagRepository.findByRecurringTransactionId(rtId)
        val tags = if (tagIds.isNotEmpty()) {
            tagRepository.findByIds(tagIds).map { it.tagToResponse() }
        } else emptyList()

        return RecurringTransactionResponse(
            id = rtId.toString(),
            name = this[RecurringTransactions.name],
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
            tags = tags,
            is_active = this[RecurringTransactions.isActive],
            version = this[RecurringTransactions.version],
            created_at = this[RecurringTransactions.createdAt].toString(),
            updated_at = this[RecurringTransactions.updatedAt].toString(),
            deleted_at = this[RecurringTransactions.deletedAt]?.toString()
        )
    }

    private fun validateRequest(request: RecurringTransactionRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.type !in com.kakeibo.shared.model.TransactionType.entries.map { it.value })
            errors.add(FieldError("type", "種別は income または expense を指定してください"))
        ValidationRules.validateAmount(request.amount)?.let {
            errors.add(FieldError("amount", it))
        }
        if (request.frequency !in com.kakeibo.shared.model.Frequency.entries.map { it.value })
            errors.add(FieldError("frequency", "頻度は daily/weekly/monthly/yearly を指定してください"))
        if (request.interval < 1)
            errors.add(FieldError("interval", "間隔は1以上を指定してください"))
        request.day_of_week?.let {
            if (it !in 0..6) errors.add(FieldError("day_of_week", "曜日は0-6（月-日）を指定してください"))
        }
        request.day_of_month?.let {
            if (it !in 1..31) errors.add(FieldError("day_of_month", "日は1-31を指定してください"))
        }
        request.month_of_year?.let {
            if (it !in 1..12) errors.add(FieldError("month_of_year", "月は1-12を指定してください"))
        }
        if (!ValidationRules.validateDate(request.start_date))
            errors.add(FieldError("start_date", "日付の形式が不正です"))
        request.end_date?.let {
            if (!ValidationRules.validateDate(it))
                errors.add(FieldError("end_date", "日付の形式が不正です"))
        }
        if (!ValidationRules.validateUuid(request.category_id))
            errors.add(FieldError("category_id", "カテゴリIDの形式が不正です"))
        if (!ValidationRules.validateUuid(request.account_id))
            errors.add(FieldError("account_id", "決済手段IDの形式が不正です"))
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
