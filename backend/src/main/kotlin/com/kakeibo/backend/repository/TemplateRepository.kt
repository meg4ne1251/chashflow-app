package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Templates
import com.kakeibo.backend.db.TemplateTags
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class TemplateRepository {
    fun findAll(): List<ResultRow> = transaction {
        Templates.selectAll()
            .where { Templates.deletedAt.isNull() }
            .orderBy(Templates.useCount to SortOrder.DESC, Templates.lastUsedAt to SortOrder.DESC_NULLS_LAST)
            .toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        Templates.selectAll().where { Templates.id eq id }.singleOrNull()
    }

    fun create(
        id: UUID, name: String, transactionName: String?, type: String, amount: Long?, currency: String,
        categoryId: UUID?, accountId: UUID?, memo: String?
    ): ResultRow = transaction {
        val now = OffsetDateTime.now()
        Templates.insert {
            it[Templates.id] = id
            it[Templates.name] = name
            it[Templates.transactionName] = transactionName
            it[Templates.type] = type
            it[Templates.amount] = amount
            it[Templates.currency] = currency
            it[Templates.categoryId] = categoryId
            it[Templates.accountId] = accountId
            it[Templates.memo] = memo
            it[Templates.useCount] = 0
            it[Templates.version] = 1
            it[Templates.createdAt] = now
            it[Templates.updatedAt] = now
        }
        findById(id)!!
    }

    fun update(
        id: UUID, name: String, transactionName: String?, type: String, amount: Long?, currency: String,
        categoryId: UUID?, accountId: UUID?, memo: String?, currentVersion: Int
    ): ResultRow? = transaction {
        val updated = Templates.update({
            (Templates.id eq id) and (Templates.version eq currentVersion) and Templates.deletedAt.isNull()
        }) {
            it[Templates.name] = name
            it[Templates.transactionName] = transactionName
            it[Templates.type] = type
            it[Templates.amount] = amount
            it[Templates.currency] = currency
            it[Templates.categoryId] = categoryId
            it[Templates.accountId] = accountId
            it[Templates.memo] = memo
            it[Templates.version] = currentVersion + 1
            it[Templates.updatedAt] = OffsetDateTime.now()
        }
        if (updated > 0) findById(id) else null
    }

    fun incrementUseCount(id: UUID) = transaction {
        val now = OffsetDateTime.now()
        Templates.update({ Templates.id eq id }) {
            with(SqlExpressionBuilder) {
                it[Templates.useCount] = Templates.useCount + 1
            }
            it[Templates.lastUsedAt] = now
            it[Templates.updatedAt] = now
        }
    }

    fun softDelete(id: UUID, currentVersion: Int): Boolean = transaction {
        val updated = Templates.update({
            (Templates.id eq id) and (Templates.version eq currentVersion) and Templates.deletedAt.isNull()
        }) {
            it[Templates.deletedAt] = OffsetDateTime.now()
            it[Templates.version] = currentVersion + 1
            it[Templates.updatedAt] = OffsetDateTime.now()
        }
        updated > 0
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        Templates.selectAll()
            .where { Templates.updatedAt greater since }
            .orderBy(Templates.updatedAt)
            .limit(limit)
            .toList()
    }
}

class TemplateTagRepository {
    fun findByTemplateId(templateId: UUID): List<UUID> = transaction {
        TemplateTags.selectAll()
            .where { TemplateTags.templateId eq templateId }
            .map { it[TemplateTags.tagId] }
    }

    fun setTags(templateId: UUID, tagIds: List<UUID>) = transaction {
        TemplateTags.deleteWhere { TemplateTags.templateId eq templateId }
        tagIds.forEach { tagId ->
            TemplateTags.insert {
                it[TemplateTags.templateId] = templateId
                it[TemplateTags.tagId] = tagId
            }
        }
    }

    fun deleteByTagId(tagId: UUID) = transaction {
        TemplateTags.deleteWhere { TemplateTags.tagId eq tagId }
    }
}
