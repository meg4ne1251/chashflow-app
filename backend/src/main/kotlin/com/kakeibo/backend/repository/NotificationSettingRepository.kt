package com.kakeibo.backend.repository

import com.kakeibo.backend.db.NotificationSettings
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class NotificationSettingRepository {
    fun findAll(): List<ResultRow> = transaction {
        NotificationSettings.selectAll()
            .where { NotificationSettings.deletedAt.isNull() }
            .toList()
    }

    fun findById(id: UUID): ResultRow? = transaction {
        NotificationSettings.selectAll()
            .where { NotificationSettings.id eq id }
            .singleOrNull()
    }

    fun findByType(type: String): ResultRow? = transaction {
        NotificationSettings.selectAll()
            .where {
                (NotificationSettings.type eq type) and NotificationSettings.deletedAt.isNull()
            }.singleOrNull()
    }

    fun update(
        id: UUID, isEnabled: Boolean?, frequency: String?,
        dayOfWeek: String?, timeOfDay: java.time.LocalTime?,
        thresholdPercent: Int?, reminderDaysBefore: Int?, currentVersion: Int
    ): ResultRow? = transaction {
        val row = findById(id) ?: return@transaction null
        if (row[NotificationSettings.deletedAt] != null) return@transaction null

        NotificationSettings.update({ (NotificationSettings.id eq id) and (NotificationSettings.version eq currentVersion) }) {
            isEnabled?.let { v -> it[NotificationSettings.isEnabled] = v }
            frequency?.let { v -> it[NotificationSettings.frequency] = v }
            dayOfWeek?.let { v -> it[NotificationSettings.dayOfWeek] = v }
            timeOfDay?.let { v -> it[NotificationSettings.timeOfDay] = v }
            thresholdPercent?.let { v -> it[NotificationSettings.thresholdPercent] = v }
            reminderDaysBefore?.let { v -> it[NotificationSettings.reminderDaysBefore] = v }
            it[NotificationSettings.version] = currentVersion + 1
            it[NotificationSettings.updatedAt] = OffsetDateTime.now()
        }
        findById(id)
    }

    fun findUpdatedSince(since: OffsetDateTime, limit: Int = 1000): List<ResultRow> = transaction {
        NotificationSettings.selectAll()
            .where { NotificationSettings.updatedAt greater since }
            .orderBy(NotificationSettings.updatedAt)
            .limit(limit)
            .toList()
    }
}
