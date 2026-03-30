package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Budgets
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class BudgetRepository {
    fun findByYearMonth(yearMonth: String): List<ResultRow> = transaction {
        Budgets.selectAll()
            .where { (Budgets.yearMonth eq yearMonth) and Budgets.deletedAt.isNull() }
            .toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        Budgets.selectAll().where { Budgets.id eq id }.singleOrNull()
    }

    fun findByCategoryAndMonth(categoryId: UUID, yearMonth: String): ResultRow? = transaction {
        Budgets.selectAll().where {
            (Budgets.categoryId eq categoryId) and
                    (Budgets.yearMonth eq yearMonth) and
                    Budgets.deletedAt.isNull()
        }.singleOrNull()
    }

    fun upsert(id: UUID, categoryId: UUID, yearMonth: String, amount: Long, currency: String): ResultRow = transaction {
        val existing = findByCategoryAndMonth(categoryId, yearMonth)
        if (existing != null) {
            val existingId = existing[Budgets.id]
            Budgets.update({ Budgets.id eq existingId }) {
                it[Budgets.amount] = amount
                it[Budgets.currency] = currency
                it[Budgets.version] = existing[Budgets.version] + 1
                it[Budgets.updatedAt] = OffsetDateTime.now()
            }
            findById(existingId) ?: throw IllegalStateException("Failed to retrieve updated budget: $existingId")
        } else {
            val now = OffsetDateTime.now()
            Budgets.insert {
                it[Budgets.id] = id
                it[Budgets.categoryId] = categoryId
                it[Budgets.yearMonth] = yearMonth
                it[Budgets.amount] = amount
                it[Budgets.currency] = currency
                it[Budgets.version] = 1
                it[Budgets.createdAt] = now
                it[Budgets.updatedAt] = now
            }
            findById(id) ?: throw IllegalStateException("Failed to retrieve created budget: $id")
        }
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val updated = Budgets.update({
            (Budgets.id eq id) and (Budgets.version eq currentVersion) and Budgets.deletedAt.isNull()
        }) {
            it[Budgets.deletedAt] = OffsetDateTime.now()
            it[Budgets.version] = currentVersion + 1
            it[Budgets.updatedAt] = OffsetDateTime.now()
        }
        updated > 0
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        Budgets.selectAll()
            .where { Budgets.updatedAt greater since }
            .orderBy(Budgets.updatedAt)
            .limit(limit)
            .toList()
    }
}
