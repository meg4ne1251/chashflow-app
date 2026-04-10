package com.kakeibo.backend.repository

import com.kakeibo.backend.db.RecurringTransactions
import com.kakeibo.backend.db.RecurringTransactionTags
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.*

class RecurringTransactionRepository {
    fun findAll(): List<ResultRow> = transaction {
        RecurringTransactions.selectAll()
            .where { RecurringTransactions.deletedAt.isNull() }
            .orderBy(RecurringTransactions.createdAt to SortOrder.DESC)
            .toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        RecurringTransactions.selectAll()
            .where { RecurringTransactions.id eq id }
            .singleOrNull()
    }

    fun findDueForExecution(date: LocalDate): List<ResultRow> = transaction {
        RecurringTransactions.selectAll()
            .where {
                (RecurringTransactions.isActive eq true) and
                        (RecurringTransactions.nextExecutionDate lessEq date) and
                        RecurringTransactions.deletedAt.isNull() and
                        ((RecurringTransactions.endDate.isNull()) or (RecurringTransactions.endDate greaterEq date))
            }
            .forUpdate()
            .toList()
    }

    fun create(
        id: UUID, type: String, amount: Long, currency: String,
        categoryId: UUID, accountId: UUID, memo: String?,
        frequency: String, interval: Int,
        dayOfWeek: Int?, dayOfMonth: Int?, monthOfYear: Int?,
        startDate: LocalDate, endDate: LocalDate?,
        nextExecutionDate: LocalDate, isActive: Boolean,
        name: String? = null
    ): ResultRow = transaction {
        val now = OffsetDateTime.now()
        RecurringTransactions.insert {
            it[RecurringTransactions.id] = id
            it[RecurringTransactions.name] = name
            it[RecurringTransactions.type] = type
            it[RecurringTransactions.amount] = amount
            it[RecurringTransactions.currency] = currency
            it[RecurringTransactions.categoryId] = categoryId
            it[RecurringTransactions.accountId] = accountId
            it[RecurringTransactions.memo] = memo
            it[RecurringTransactions.frequency] = frequency
            it[RecurringTransactions.interval] = interval
            it[RecurringTransactions.dayOfWeek] = dayOfWeek
            it[RecurringTransactions.dayOfMonth] = dayOfMonth
            it[RecurringTransactions.monthOfYear] = monthOfYear
            it[RecurringTransactions.startDate] = startDate
            it[RecurringTransactions.endDate] = endDate
            it[RecurringTransactions.nextExecutionDate] = nextExecutionDate
            it[RecurringTransactions.isActive] = isActive
            it[RecurringTransactions.version] = 1
            it[RecurringTransactions.createdAt] = now
            it[RecurringTransactions.updatedAt] = now
        }
        findById(id) ?: throw IllegalStateException("Failed to retrieve created recurring transaction: $id")
    }

    fun update(
        id: UUID, type: String, amount: Long, currency: String,
        categoryId: UUID, accountId: UUID, memo: String?,
        frequency: String, interval: Int,
        dayOfWeek: Int?, dayOfMonth: Int?, monthOfYear: Int?,
        startDate: LocalDate, endDate: LocalDate?,
        nextExecutionDate: LocalDate, isActive: Boolean, currentVersion: Int,
        name: String? = null
    ): ResultRow? = transaction {
        val updated = RecurringTransactions.update({
            (RecurringTransactions.id eq id) and
                    (RecurringTransactions.version eq currentVersion) and
                    RecurringTransactions.deletedAt.isNull()
        }) {
            it[RecurringTransactions.name] = name
            it[RecurringTransactions.type] = type
            it[RecurringTransactions.amount] = amount
            it[RecurringTransactions.currency] = currency
            it[RecurringTransactions.categoryId] = categoryId
            it[RecurringTransactions.accountId] = accountId
            it[RecurringTransactions.memo] = memo
            it[RecurringTransactions.frequency] = frequency
            it[RecurringTransactions.interval] = interval
            it[RecurringTransactions.dayOfWeek] = dayOfWeek
            it[RecurringTransactions.dayOfMonth] = dayOfMonth
            it[RecurringTransactions.monthOfYear] = monthOfYear
            it[RecurringTransactions.startDate] = startDate
            it[RecurringTransactions.endDate] = endDate
            it[RecurringTransactions.nextExecutionDate] = nextExecutionDate
            it[RecurringTransactions.isActive] = isActive
            it[RecurringTransactions.version] = currentVersion + 1
            it[RecurringTransactions.updatedAt] = OffsetDateTime.now()
        }
        if (updated > 0) findById(id) else null
    }

    fun updateNextExecutionDate(id: UUID, nextDate: LocalDate, currentVersion: Int) = transaction {
        val updated = RecurringTransactions.update({
            (RecurringTransactions.id eq id) and (RecurringTransactions.version eq currentVersion)
        }) {
            it[RecurringTransactions.nextExecutionDate] = nextDate
            it[RecurringTransactions.version] = currentVersion + 1
            it[RecurringTransactions.updatedAt] = OffsetDateTime.now()
        }
        updated
    }

    fun toggleActive(id: UUID): ResultRow? = transaction {
        val row = findById(id) ?: return@transaction null
        if (row[RecurringTransactions.deletedAt] != null) return@transaction null
        val currentActive = row[RecurringTransactions.isActive]
        RecurringTransactions.update({ RecurringTransactions.id eq id }) {
            it[RecurringTransactions.isActive] = !currentActive
            it[RecurringTransactions.updatedAt] = OffsetDateTime.now()
            it[RecurringTransactions.version] = row[RecurringTransactions.version] + 1
        }
        findById(id)
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val updated = RecurringTransactions.update({
            (RecurringTransactions.id eq id) and
                    (RecurringTransactions.version eq currentVersion) and
                    RecurringTransactions.deletedAt.isNull()
        }) {
            it[RecurringTransactions.deletedAt] = OffsetDateTime.now()
            it[RecurringTransactions.version] = currentVersion + 1
            it[RecurringTransactions.updatedAt] = OffsetDateTime.now()
        }
        updated > 0
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        RecurringTransactions.selectAll()
            .where { RecurringTransactions.updatedAt greater since }
            .orderBy(RecurringTransactions.updatedAt)
            .limit(limit)
            .toList()
    }
}

class RecurringTransactionTagRepository {
    fun findByRecurringTransactionId(recurringTransactionId: UUID): List<UUID> = transaction {
        RecurringTransactionTags.selectAll()
            .where { RecurringTransactionTags.recurringTransactionId eq recurringTransactionId }
            .map { it[RecurringTransactionTags.tagId] }
    }

    fun setTags(recurringTransactionId: UUID, tagIds: List<UUID>) = transaction {
        RecurringTransactionTags.deleteWhere {
            RecurringTransactionTags.recurringTransactionId eq recurringTransactionId
        }
        if (tagIds.isNotEmpty()) {
            RecurringTransactionTags.batchInsert(tagIds) { tagId ->
                this[RecurringTransactionTags.recurringTransactionId] = recurringTransactionId
                this[RecurringTransactionTags.tagId] = tagId
            }
        }
    }

    fun deleteByTagId(tagId: UUID) = transaction {
        RecurringTransactionTags.deleteWhere { RecurringTransactionTags.tagId eq tagId }
    }
}
