package com.kakeibo.backend.service

import com.kakeibo.backend.db.NotificationSettings
import com.kakeibo.backend.middleware.NotFoundException
import com.kakeibo.backend.middleware.ConflictException
import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.NotificationSettingRepository
import com.kakeibo.shared.model.FieldError
import com.kakeibo.shared.model.NotificationSettingRequest
import com.kakeibo.shared.model.NotificationSettingResponse
import org.jetbrains.exposed.sql.ResultRow
import java.time.LocalTime
import java.util.*

class NotificationSettingService(
    private val notificationSettingRepository: NotificationSettingRepository
) {
    fun getAll(): List<NotificationSettingResponse> {
        return notificationSettingRepository.findAll().map { it.toResponse() }
    }

    fun update(id: String, request: NotificationSettingRequest): NotificationSettingResponse {
        val uuid = UUID.fromString(id)
        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val timeOfDay = request.time_of_day?.let {
            try { LocalTime.parse(it) } catch (_: Exception) {
                throw ValidationException("時刻のフォーマットが不正です", listOf(FieldError("time_of_day", "HH:mm形式で指定してください")))
            }
        }

        request.threshold_percent?.let {
            if (it !in 1..100) throw ValidationException(
                "閾値は1〜100の範囲で指定してください",
                listOf(FieldError("threshold_percent", "1〜100の範囲で指定してください"))
            )
        }

        request.reminder_days_before?.let {
            if (it !in 0..31) throw ValidationException(
                "通知日数は0〜31の範囲で指定してください",
                listOf(FieldError("reminder_days_before", "0〜31の範囲で指定してください"))
            )
        }

        val row = notificationSettingRepository.update(
            id = uuid,
            isEnabled = request.is_enabled,
            frequency = request.frequency,
            dayOfWeek = request.day_of_week,
            timeOfDay = timeOfDay,
            thresholdPercent = request.threshold_percent,
            reminderDaysBefore = request.reminder_days_before,
            currentVersion = currentVersion
        ) ?: throw ConflictException("バージョン競合が発生しました")

        return row.toResponse()
    }

    private fun ResultRow.toResponse() = NotificationSettingResponse(
        id = this[NotificationSettings.id].toString(),
        type = this[NotificationSettings.type],
        is_enabled = this[NotificationSettings.isEnabled],
        frequency = this[NotificationSettings.frequency],
        day_of_week = this[NotificationSettings.dayOfWeek],
        time_of_day = this[NotificationSettings.timeOfDay]?.toString(),
        threshold_percent = this[NotificationSettings.thresholdPercent],
        reminder_days_before = this[NotificationSettings.reminderDaysBefore],
        version = this[NotificationSettings.version],
        created_at = this[NotificationSettings.createdAt].toString(),
        updated_at = this[NotificationSettings.updatedAt].toString()
    )
}
