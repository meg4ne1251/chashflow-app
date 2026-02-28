package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Accounts
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class AccountRepository {
    fun findAll(includeDeleted: Boolean = false): List<ResultRow> = transaction {
        Accounts.selectAll().apply {
            if (!includeDeleted) andWhere { Accounts.deletedAt.isNull() }
        }.orderBy(Accounts.sortOrder).toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        Accounts.selectAll().where { Accounts.id eq id }.singleOrNull()
    }

    fun findActiveById(id: UUID): ResultRow? = transaction {
        Accounts.selectAll().where {
            (Accounts.id eq id) and Accounts.deletedAt.isNull()
        }.singleOrNull()
    }

    fun create(id: UUID, name: String, type: String, initialBalance: Long, currency: String, sortOrder: Int): ResultRow = transaction {
        val now = OffsetDateTime.now()
        Accounts.insert {
            it[Accounts.id] = id
            it[Accounts.name] = name
            it[Accounts.type] = type
            it[Accounts.initialBalance] = initialBalance
            it[Accounts.currency] = currency
            it[Accounts.sortOrder] = sortOrder
            it[Accounts.version] = 1
            it[Accounts.createdAt] = now
            it[Accounts.updatedAt] = now
        }
        findById(id)!!
    }

    fun update(id: UUID, name: String, type: String, initialBalance: Long, currency: String, sortOrder: Int, currentVersion: Int): ResultRow? = transaction {
        val now = OffsetDateTime.now()
        val updated = Accounts.update({
            (Accounts.id eq id) and (Accounts.version eq currentVersion) and Accounts.deletedAt.isNull()
        }) {
            it[Accounts.name] = name
            it[Accounts.type] = type
            it[Accounts.initialBalance] = initialBalance
            it[Accounts.currency] = currency
            it[Accounts.sortOrder] = sortOrder
            it[Accounts.version] = currentVersion + 1
            it[Accounts.updatedAt] = now
        }
        if (updated > 0) findById(id) else null
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val now = OffsetDateTime.now()
        val updated = Accounts.update({
            (Accounts.id eq id) and (Accounts.version eq currentVersion) and Accounts.deletedAt.isNull()
        }) {
            it[Accounts.deletedAt] = now
            it[Accounts.version] = currentVersion + 1
            it[Accounts.updatedAt] = now
        }
        updated > 0
    }

    fun existsByName(name: String, excludeId: UUID? = null): Boolean = transaction {
        Accounts.selectAll().where {
            (Accounts.name eq name) and Accounts.deletedAt.isNull() and
                    if (excludeId != null) (Accounts.id neq excludeId) else Op.TRUE
        }.count() > 0
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        Accounts.selectAll()
            .where { Accounts.updatedAt greater since }
            .orderBy(Accounts.updatedAt)
            .limit(limit)
            .toList()
    }
}
