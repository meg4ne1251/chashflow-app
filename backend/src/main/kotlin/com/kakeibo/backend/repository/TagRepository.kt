package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Tags
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class TagRepository {
    fun findAll(includeDeleted: Boolean = false): List<ResultRow> = transaction {
        Tags.selectAll().apply {
            if (!includeDeleted) andWhere { Tags.deletedAt.isNull() }
        }.orderBy(Tags.name).toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        Tags.selectAll().where { Tags.id eq id }.singleOrNull()
    }

    fun findActiveById(id: UUID): ResultRow? = transaction {
        Tags.selectAll().where {
            (Tags.id eq id) and Tags.deletedAt.isNull()
        }.singleOrNull()
    }

    fun findByIds(ids: List<UUID>): List<ResultRow> = transaction {
        Tags.selectAll().where { Tags.id inList ids }.toList()
    }

    fun create(id: UUID, name: String, color: String?): ResultRow = transaction {
        val now = OffsetDateTime.now()
        Tags.insert {
            it[Tags.id] = id
            it[Tags.name] = name
            it[Tags.color] = color
            it[Tags.version] = 1
            it[Tags.createdAt] = now
            it[Tags.updatedAt] = now
        }
        findById(id)!!
    }

    fun update(id: UUID, name: String, color: String?, currentVersion: Int): ResultRow? = transaction {
        val now = OffsetDateTime.now()
        val updated = Tags.update({
            (Tags.id eq id) and (Tags.version eq currentVersion) and Tags.deletedAt.isNull()
        }) {
            it[Tags.name] = name
            it[Tags.color] = color
            it[Tags.version] = currentVersion + 1
            it[Tags.updatedAt] = now
        }
        if (updated > 0) findById(id) else null
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val now = OffsetDateTime.now()
        val updated = Tags.update({
            (Tags.id eq id) and (Tags.version eq currentVersion) and Tags.deletedAt.isNull()
        }) {
            it[Tags.deletedAt] = now
            it[Tags.version] = currentVersion + 1
            it[Tags.updatedAt] = now
        }
        updated > 0
    }

    fun existsByName(name: String, excludeId: UUID? = null): Boolean = transaction {
        Tags.selectAll().where {
            (Tags.name eq name) and Tags.deletedAt.isNull() and
                    if (excludeId != null) (Tags.id neq excludeId) else Op.TRUE
        }.count() > 0
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        Tags.selectAll()
            .where { Tags.updatedAt greater since }
            .orderBy(Tags.updatedAt)
            .limit(limit)
            .toList()
    }
}
