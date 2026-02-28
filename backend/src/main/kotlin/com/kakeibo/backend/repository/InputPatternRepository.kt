package com.kakeibo.backend.repository

import com.kakeibo.backend.db.InputPatterns
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class InputPatternRepository {
    fun findByKeyword(keyword: String): ResultRow? = transaction {
        InputPatterns.selectAll().where {
            (InputPatterns.keyword eq keyword) and InputPatterns.deletedAt.isNull()
        }.singleOrNull()
    }

    fun searchByKeyword(keyword: String, limit: Int = 10): List<ResultRow> = transaction {
        val escaped = keyword.replace("%", "\\%").replace("_", "\\_")
        InputPatterns.selectAll().where {
            (InputPatterns.keyword like "$escaped%") and InputPatterns.deletedAt.isNull()
        }
            .orderBy(InputPatterns.hitCount to SortOrder.DESC)
            .limit(limit)
            .toList()
    }

    fun upsert(keyword: String, categoryId: UUID?, accountId: UUID?) = transaction {
        val existing = findByKeyword(keyword)
        if (existing != null) {
            InputPatterns.update({ InputPatterns.id eq existing[InputPatterns.id] }) {
                categoryId?.let { v -> it[InputPatterns.categoryId] = v }
                accountId?.let { v -> it[InputPatterns.accountId] = v }
                with(SqlExpressionBuilder) {
                    it[InputPatterns.hitCount] = InputPatterns.hitCount + 1
                }
                it[InputPatterns.lastUsedAt] = OffsetDateTime.now()
                it[InputPatterns.updatedAt] = OffsetDateTime.now()
            }
        } else {
            val now = OffsetDateTime.now()
            InputPatterns.insert {
                it[InputPatterns.id] = UUID.randomUUID()
                it[InputPatterns.keyword] = keyword
                it[InputPatterns.categoryId] = categoryId
                it[InputPatterns.accountId] = accountId
                it[InputPatterns.hitCount] = 1
                it[InputPatterns.lastUsedAt] = now
                it[InputPatterns.version] = 1
                it[InputPatterns.createdAt] = now
                it[InputPatterns.updatedAt] = now
            }
        }
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        InputPatterns.selectAll()
            .where { InputPatterns.updatedAt greater since }
            .orderBy(InputPatterns.updatedAt)
            .limit(limit)
            .toList()
    }
}
