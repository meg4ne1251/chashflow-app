package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Transfers
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.*

class TransferRepository {
    fun findAll(
        dateFrom: LocalDate? = null,
        dateTo: LocalDate? = null,
        accountId: UUID? = null,
        page: Int = 1,
        size: Int = 50
    ): Pair<List<ResultRow>, Long> = transaction {
        val query = Transfers.selectAll().apply {
            andWhere { Transfers.deletedAt.isNull() }
            dateFrom?.let { andWhere { Transfers.date greaterEq it } }
            dateTo?.let { andWhere { Transfers.date lessEq it } }
            accountId?.let { id ->
                andWhere { (Transfers.fromAccountId eq id) or (Transfers.toAccountId eq id) }
            }
        }
        val totalCount = query.count()
        val rows = query
            .orderBy(Transfers.date to SortOrder.DESC)
            .limit(size).offset(((page - 1) * size).toLong())
            .toList()
        Pair(rows, totalCount)
    }

    fun findById(id: UUID): ResultRow? = transaction {
        Transfers.selectAll().where { Transfers.id eq id }.singleOrNull()
    }

    fun create(
        id: UUID, fromAccountId: UUID, toAccountId: UUID,
        amount: Long, currency: String, date: LocalDate, memo: String?
    ): ResultRow = transaction {
        val now = OffsetDateTime.now()
        Transfers.insert {
            it[Transfers.id] = id
            it[Transfers.fromAccountId] = fromAccountId
            it[Transfers.toAccountId] = toAccountId
            it[Transfers.amount] = amount
            it[Transfers.currency] = currency
            it[Transfers.date] = date
            it[Transfers.memo] = memo
            it[Transfers.version] = 1
            it[Transfers.createdAt] = now
            it[Transfers.updatedAt] = now
        }
        findById(id) ?: throw IllegalStateException("Failed to retrieve created transfer: $id")
    }

    fun update(
        id: UUID, fromAccountId: UUID, toAccountId: UUID,
        amount: Long, currency: String, date: LocalDate, memo: String?,
        currentVersion: Int
    ): ResultRow? = transaction {
        val updated = Transfers.update({
            (Transfers.id eq id) and (Transfers.version eq currentVersion)
        }) {
            it[Transfers.fromAccountId] = fromAccountId
            it[Transfers.toAccountId] = toAccountId
            it[Transfers.amount] = amount
            it[Transfers.currency] = currency
            it[Transfers.date] = date
            it[Transfers.memo] = memo
            it[Transfers.version] = currentVersion + 1
            it[Transfers.updatedAt] = OffsetDateTime.now()
        }
        if (updated > 0) findById(id) else null
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val updated = Transfers.update({
            (Transfers.id eq id) and (Transfers.version eq currentVersion)
        }) {
            it[Transfers.deletedAt] = OffsetDateTime.now()
            it[Transfers.version] = currentVersion + 1
            it[Transfers.updatedAt] = OffsetDateTime.now()
        }
        updated > 0
    }

    fun restore(id: UUID): Boolean = transaction {
        val row = findById(id) ?: return@transaction false
        val currentVersion = row[Transfers.version]
        val updated = Transfers.update({ Transfers.id eq id }) {
            it[Transfers.deletedAt] = null
            it[Transfers.version] = currentVersion + 1
            it[Transfers.updatedAt] = OffsetDateTime.now()
        }
        updated > 0
    }

    fun sumByAccountDirection(accountId: UUID, direction: String): Long = transaction {
        val column = if (direction == "from") Transfers.fromAccountId else Transfers.toAccountId
        Transfers.select(Transfers.amount.sum())
            .where { (column eq accountId) and Transfers.deletedAt.isNull() }
            .singleOrNull()?.get(Transfers.amount.sum()) ?: 0L
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        Transfers.selectAll()
            .where { Transfers.updatedAt greater since }
            .orderBy(Transfers.updatedAt)
            .limit(limit)
            .toList()
    }
}
