package com.kakeibo.backend.repository

import com.kakeibo.backend.db.SavingsGoals
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.*

class SavingsGoalRepository {
    fun findAll(includeDeleted: Boolean = false): List<ResultRow> = transaction {
        SavingsGoals.selectAll()
            .apply { if (!includeDeleted) where { SavingsGoals.deletedAt.isNull() } }
            .orderBy(SavingsGoals.sortOrder)
            .toList()
    }

    fun findActive(): List<ResultRow> = transaction {
        SavingsGoals.selectAll()
            .where { SavingsGoals.deletedAt.isNull() and (SavingsGoals.status eq "active") }
            .orderBy(SavingsGoals.sortOrder)
            .toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        SavingsGoals.selectAll().where { SavingsGoals.id eq id }.singleOrNull()
    }

    fun findActiveById(id: UUID): ResultRow? = transaction {
        SavingsGoals.selectAll().where {
            (SavingsGoals.id eq id) and SavingsGoals.deletedAt.isNull()
        }.singleOrNull()
    }

    fun create(
        id: UUID,
        name: String,
        targetAmount: Long,
        currentAmount: Long,
        currency: String,
        deadline: LocalDate?,
        accountId: UUID?,
        icon: String?,
        color: String?,
        sortOrder: Int
    ): ResultRow = transaction {
        val now = OffsetDateTime.now()
        SavingsGoals.insert {
            it[SavingsGoals.id] = id
            it[SavingsGoals.name] = name
            it[SavingsGoals.targetAmount] = targetAmount
            it[SavingsGoals.currentAmount] = currentAmount
            it[SavingsGoals.currency] = currency
            it[SavingsGoals.deadline] = deadline
            it[SavingsGoals.accountId] = accountId
            it[SavingsGoals.icon] = icon
            it[SavingsGoals.color] = color
            it[SavingsGoals.sortOrder] = sortOrder
            it[SavingsGoals.status] = "active"
            it[SavingsGoals.version] = 1
            it[SavingsGoals.createdAt] = now
            it[SavingsGoals.updatedAt] = now
        }
        findById(id) ?: throw IllegalStateException("Failed to retrieve created savings goal: $id")
    }

    fun update(
        id: UUID,
        name: String,
        targetAmount: Long,
        currentAmount: Long,
        currency: String,
        deadline: LocalDate?,
        accountId: UUID?,
        icon: String?,
        color: String?,
        sortOrder: Int,
        currentVersion: Int
    ): ResultRow? = transaction {
        val updated = SavingsGoals.update({
            (SavingsGoals.id eq id) and (SavingsGoals.version eq currentVersion) and SavingsGoals.deletedAt.isNull()
        }) {
            it[SavingsGoals.name] = name
            it[SavingsGoals.targetAmount] = targetAmount
            it[SavingsGoals.currentAmount] = currentAmount
            it[SavingsGoals.currency] = currency
            it[SavingsGoals.deadline] = deadline
            it[SavingsGoals.accountId] = accountId
            it[SavingsGoals.icon] = icon
            it[SavingsGoals.color] = color
            it[SavingsGoals.sortOrder] = sortOrder
            it[SavingsGoals.version] = currentVersion + 1
            it[SavingsGoals.updatedAt] = OffsetDateTime.now()
        }
        if (updated > 0) findById(id) else null
    }

    fun updateCurrentAmount(id: UUID, currentAmount: Long, currentVersion: Int): ResultRow? = transaction {
        val now = OffsetDateTime.now()
        val achieved = findById(id)?.let { it[SavingsGoals.targetAmount] <= currentAmount } == true
        val updated = SavingsGoals.update({
            (SavingsGoals.id eq id) and (SavingsGoals.version eq currentVersion) and SavingsGoals.deletedAt.isNull()
        }) {
            it[SavingsGoals.currentAmount] = currentAmount
            if (achieved) {
                it[SavingsGoals.status] = "achieved"
                it[SavingsGoals.achievedAt] = now
            }
            it[SavingsGoals.version] = currentVersion + 1
            it[SavingsGoals.updatedAt] = now
        }
        if (updated > 0) findById(id) else null
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val updated = SavingsGoals.update({
            (SavingsGoals.id eq id) and (SavingsGoals.version eq currentVersion) and SavingsGoals.deletedAt.isNull()
        }) {
            it[SavingsGoals.deletedAt] = OffsetDateTime.now()
            it[SavingsGoals.version] = currentVersion + 1
            it[SavingsGoals.updatedAt] = OffsetDateTime.now()
        }
        updated > 0
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        SavingsGoals.selectAll()
            .where { SavingsGoals.updatedAt greater since }
            .orderBy(SavingsGoals.updatedAt)
            .limit(limit)
            .toList()
    }
}
