package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Notifications
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.*

class NotificationRepository {

    fun create(type: String, title: String, message: String): ResultRow = transaction {
        val id = UUID.randomUUID()
        val now = OffsetDateTime.now()
        Notifications.insert {
            it[Notifications.id] = id
            it[Notifications.type] = type
            it[Notifications.title] = title
            it[Notifications.message] = message
            it[Notifications.isRead] = false
            it[Notifications.createdAt] = now
        }
        Notifications.selectAll().where { Notifications.id eq id }.single()
    }

    fun findUnread(limit: Int = 50): List<ResultRow> = transaction {
        Notifications.selectAll()
            .where { Notifications.isRead eq false }
            .orderBy(Notifications.createdAt, SortOrder.DESC)
            .limit(limit)
            .toList()
    }

    fun findRecent(limit: Int = 20): List<ResultRow> = transaction {
        Notifications.selectAll()
            .orderBy(Notifications.createdAt, SortOrder.DESC)
            .limit(limit)
            .toList()
    }

    fun findAllPaginated(
        type: String? = null,
        isRead: Boolean? = null,
        page: Int = 1,
        size: Int = 50
    ): Pair<List<ResultRow>, Long> = transaction {
        val query = Notifications.selectAll().apply {
            type?.let { andWhere { Notifications.type eq it } }
            isRead?.let { andWhere { Notifications.isRead eq it } }
        }
        val totalCount = query.count()
        query.orderBy(Notifications.createdAt, SortOrder.DESC)
            .limit(size)
            .offset(((page - 1) * size).toLong())
        Pair(query.toList(), totalCount)
    }

    fun markAsRead(id: UUID): Boolean = transaction {
        Notifications.update({ Notifications.id eq id }) {
            it[isRead] = true
            it[readAt] = OffsetDateTime.now()
        } > 0
    }

    fun markAllAsRead(): Int = transaction {
        Notifications.update({ Notifications.isRead eq false }) {
            it[isRead] = true
            it[readAt] = OffsetDateTime.now()
        }
    }

    fun countUnread(): Long = transaction {
        Notifications.selectAll()
            .where { Notifications.isRead eq false }
            .count()
    }

    fun existsTodayByType(type: String): Boolean = transaction {
        val todayStart = OffsetDateTime.now(ZoneId.of("Asia/Tokyo"))
            .toLocalDate().atStartOfDay().atOffset(OffsetDateTime.now(ZoneId.of("Asia/Tokyo")).offset)
        Notifications.selectAll()
            .where { (Notifications.type eq type) and (Notifications.createdAt greaterEq todayStart) }
            .count() > 0
    }

    fun existsTodayByTypeAndMessageContaining(type: String, keyword: String): Boolean = transaction {
        val todayStart = OffsetDateTime.now(ZoneId.of("Asia/Tokyo"))
            .toLocalDate().atStartOfDay().atOffset(OffsetDateTime.now(ZoneId.of("Asia/Tokyo")).offset)
        // SQLインジェクション対策: LIKE特殊文字をエスケープ
        val escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        Notifications.selectAll()
            .where {
                (Notifications.type eq type) and
                (Notifications.createdAt greaterEq todayStart) and
                (Notifications.message like "%$escaped%")
            }
            .count() > 0
    }

    fun deleteOlderThan(days: Long): Int = transaction {
        val cutoff = OffsetDateTime.now().minusDays(days)
        Notifications.deleteWhere { Notifications.createdAt less cutoff }
    }
}
