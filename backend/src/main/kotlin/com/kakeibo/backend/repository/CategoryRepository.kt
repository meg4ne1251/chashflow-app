package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Categories
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class CategoryRepository {
    fun findAll(includeDeleted: Boolean = false): List<ResultRow> = transaction {
        Categories.selectAll().apply {
            if (!includeDeleted) andWhere { Categories.deletedAt.isNull() }
        }.orderBy(Categories.type).orderBy(Categories.sortOrder).toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        Categories.selectAll().where { Categories.id eq id }.singleOrNull()
    }

    fun findByIds(ids: List<UUID>): List<ResultRow> = transaction {
        Categories.selectAll().where { Categories.id inList ids }.toList()
    }

    fun findActiveById(id: UUID): ResultRow? = transaction {
        Categories.selectAll().where {
            (Categories.id eq id) and Categories.deletedAt.isNull()
        }.singleOrNull()
    }

    fun findByType(type: String): List<ResultRow> = transaction {
        Categories.selectAll().where {
            (Categories.type eq type) and Categories.deletedAt.isNull()
        }.orderBy(Categories.sortOrder).toList()
    }

    fun create(id: UUID, name: String, type: String, icon: String?, color: String?, sortOrder: Int): ResultRow = transaction {
        val now = OffsetDateTime.now()
        Categories.insert {
            it[Categories.id] = id
            it[Categories.name] = name
            it[Categories.type] = type
            it[Categories.icon] = icon
            it[Categories.color] = color
            it[Categories.sortOrder] = sortOrder
            it[Categories.isDefault] = false
            it[Categories.version] = 1
            it[Categories.createdAt] = now
            it[Categories.updatedAt] = now
        }
        findById(id) ?: throw IllegalStateException("Failed to retrieve created category: $id")
    }

    fun update(id: UUID, name: String, type: String, icon: String?, color: String?, sortOrder: Int, currentVersion: Int): ResultRow? = transaction {
        val now = OffsetDateTime.now()
        val updated = Categories.update({
            (Categories.id eq id) and (Categories.version eq currentVersion) and Categories.deletedAt.isNull()
        }) {
            it[Categories.name] = name
            it[Categories.type] = type
            it[Categories.icon] = icon
            it[Categories.color] = color
            it[Categories.sortOrder] = sortOrder
            it[Categories.version] = currentVersion + 1
            it[Categories.updatedAt] = now
        }
        if (updated > 0) findById(id) else null
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val now = OffsetDateTime.now()
        val updated = Categories.update({
            (Categories.id eq id) and (Categories.version eq currentVersion) and Categories.deletedAt.isNull()
        }) {
            it[Categories.deletedAt] = now
            it[Categories.version] = currentVersion + 1
            it[Categories.updatedAt] = now
        }
        updated > 0
    }

    fun existsByNameAndType(name: String, type: String, excludeId: UUID? = null): Boolean = transaction {
        Categories.selectAll().where {
            (Categories.name eq name) and (Categories.type eq type) and Categories.deletedAt.isNull() and
                    if (excludeId != null) (Categories.id neq excludeId) else Op.TRUE
        }.count() > 0
    }

    fun findFallbackCategory(type: String): ResultRow? = transaction {
        val pattern = LikePattern("%その他%", '\\')
        Categories.selectAll().where {
            (Categories.type eq type) and Categories.deletedAt.isNull() and Categories.isDefault and
                    (Categories.name like pattern)
        }.singleOrNull()
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        Categories.selectAll()
            .where { Categories.updatedAt greater since }
            .orderBy(Categories.updatedAt)
            .limit(limit)
            .toList()
    }
}
