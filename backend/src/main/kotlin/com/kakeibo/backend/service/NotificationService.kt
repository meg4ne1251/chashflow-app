package com.kakeibo.backend.service

import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.Budgets
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.db.Notifications
import com.kakeibo.backend.repository.AccountRepository
import com.kakeibo.backend.repository.BudgetRepository
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.NotificationRepository
import com.kakeibo.backend.repository.NotificationSettingRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.shared.model.NotificationListResponse
import com.kakeibo.shared.model.NotificationResponse
import com.kakeibo.shared.model.PaginatedResponse
import com.kakeibo.shared.model.PaginationInfo
import org.jetbrains.exposed.sql.ResultRow
import org.slf4j.LoggerFactory
import java.time.DayOfWeek
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.*

class NotificationService(
    private val notificationRepository: NotificationRepository,
    private val notificationSettingRepository: NotificationSettingRepository,
    private val budgetRepository: BudgetRepository,
    private val transactionRepository: TransactionRepository,
    private val categoryRepository: CategoryRepository,
    private val accountRepository: AccountRepository
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    companion object {
        private val TARGET_ZONE = ZoneId.of("Asia/Tokyo")
    }

    // =========================================
    // Polling API methods
    // =========================================

    fun getUnread(): NotificationListResponse {
        val rows = notificationRepository.findUnread()
        return NotificationListResponse(
            notifications = rows.map { it.toResponse() },
            unread_count = rows.size
        )
    }

    fun getRecent(): NotificationListResponse {
        val rows = notificationRepository.findRecent()
        val unreadCount = notificationRepository.countUnread()
        return NotificationListResponse(
            notifications = rows.map { it.toResponse() },
            unread_count = unreadCount.toInt()
        )
    }

    fun getHistory(
        type: String? = null,
        isRead: Boolean? = null,
        page: Int = 1,
        size: Int = 50
    ): PaginatedResponse<NotificationResponse> {
        val (rows, totalCount) = notificationRepository.findAllPaginated(type, isRead, page, size)
        val totalPages = ((totalCount + size - 1) / size).toInt()
        return PaginatedResponse(
            data = rows.map { it.toResponse() },
            pagination = PaginationInfo(
                page = page,
                size = size,
                total_count = totalCount,
                total_pages = totalPages,
                has_next = page < totalPages
            )
        )
    }

    fun markAsRead(id: String) {
        notificationRepository.markAsRead(UUID.fromString(id))
    }

    fun markAllAsRead() {
        notificationRepository.markAllAsRead()
    }

    // =========================================
    // Scheduler methods
    // =========================================

    fun checkAndGenerateInputReminder() {
        val setting = notificationSettingRepository.findByType("input_remind") ?: return
        val isEnabled = setting[com.kakeibo.backend.db.NotificationSettings.isEnabled]
        if (!isEnabled) return

        val frequency = setting[com.kakeibo.backend.db.NotificationSettings.frequency] ?: return
        val timeOfDay = setting[com.kakeibo.backend.db.NotificationSettings.timeOfDay] ?: return
        val dayOfWeekStr = setting[com.kakeibo.backend.db.NotificationSettings.dayOfWeek]

        val now = ZonedDateTime.now(TARGET_ZONE)
        val currentTime = now.toLocalTime()

        // Check time match (within 1-minute window)
        if (!isTimeMatch(currentTime, timeOfDay)) return

        // Check frequency/day match
        when (frequency) {
            "daily" -> { /* always matches */ }
            "weekly" -> {
                val targetDay = parseDayOfWeek(dayOfWeekStr) ?: return
                if (now.dayOfWeek != targetDay) return
            }
            "biweekly" -> {
                val targetDay = parseDayOfWeek(dayOfWeekStr) ?: return
                if (now.dayOfWeek != targetDay) return
                // Use epoch day / 7 parity for biweekly
                val weekNumber = now.toLocalDate().toEpochDay() / 7
                if (weekNumber % 2 != 0L) return
            }
            else -> return
        }

        // Avoid duplicate
        if (notificationRepository.existsTodayByType("input_remind")) return

        notificationRepository.create(
            type = "input_remind",
            title = "入力リマインダー",
            message = "今日の支出を記録しましょう"
        )
        logger.info("入力リマインダー通知を生成しました")
    }

    fun checkAndGenerateBudgetAlerts() {
        val setting = notificationSettingRepository.findByType("budget_alert") ?: return
        val isEnabled = setting[com.kakeibo.backend.db.NotificationSettings.isEnabled]
        if (!isEnabled) return

        val thresholdPercent = setting[com.kakeibo.backend.db.NotificationSettings.thresholdPercent] ?: return

        val now = ZonedDateTime.now(TARGET_ZONE)
        val yearMonth = String.format("%04d-%02d", now.year, now.monthValue)

        val budgets = budgetRepository.findByYearMonth(yearMonth)
        if (budgets.isEmpty()) return

        val spentByCategory = transactionRepository.sumAllCategoriesByMonth(yearMonth)
        val allCategories = categoryRepository.findAll()
        val categoryNameMap = allCategories.associate { it[Categories.id] to it[Categories.name] }

        for (budget in budgets) {
            val categoryId = budget[Budgets.categoryId]
            val budgetAmount = budget[Budgets.amount]
            val spent = spentByCategory[categoryId] ?: 0L

            if (budgetAmount <= 0) continue

            val consumptionRate = (spent.toDouble() / budgetAmount.toDouble()) * 100.0
            if (consumptionRate < thresholdPercent) continue

            val categoryName = categoryNameMap[categoryId] ?: "不明"

            // Avoid duplicate alert per category per day
            if (notificationRepository.existsTodayByTypeAndMessageContaining(
                    "budget_alert", categoryId.toString()
                )) continue

            val rateStr = String.format("%.0f", consumptionRate)
            notificationRepository.create(
                type = "budget_alert",
                title = "予算アラート",
                message = "「${categoryName}」の予算消化率が${rateStr}%に達しました（閾値: ${thresholdPercent}%）[${categoryId}]"
            )
            logger.info("予算アラート通知を生成しました: $categoryName ($rateStr%)")
        }
    }

    fun checkAndGenerateCreditCardPaymentReminders() {
        val setting = notificationSettingRepository.findByType("credit_card_payment") ?: return
        val isEnabled = setting[com.kakeibo.backend.db.NotificationSettings.isEnabled]
        if (!isEnabled) return

        val now = ZonedDateTime.now(TARGET_ZONE)
        val today = now.toLocalDate()
        val reminderTarget = today.plusDays(3)
        val targetDay = reminderTarget.dayOfMonth

        val creditCards = accountRepository.findCreditCardsWithPaymentDay()
        if (creditCards.isEmpty()) return

        for (card in creditCards) {
            val paymentDay = card[Accounts.paymentDay] ?: continue
            if (paymentDay != targetDay) continue

            val cardName = card[Accounts.name]
            val cardId = card[Accounts.id].toString()

            // Avoid duplicate per card per day
            if (notificationRepository.existsTodayByTypeAndMessageContaining(
                    "credit_card_payment", cardId
                )) continue

            val paymentDateStr = String.format("%d/%d", reminderTarget.monthValue, reminderTarget.dayOfMonth)
            notificationRepository.create(
                type = "credit_card_payment",
                title = "クレジットカード引落し予定",
                message = "「${cardName}」の引落し日が3日後（${paymentDateStr}）です。口座残高を確認してください。[${cardId}]"
            )
            logger.info("クレジットカード引落しリマインダーを生成しました: $cardName ($paymentDateStr)")
        }
    }

    fun cleanupOldNotifications() {
        val deleted = notificationRepository.deleteOlderThan(90)
        if (deleted > 0) {
            logger.info("古い通知を${deleted}件削除しました")
        }
    }

    // =========================================
    // Private helpers
    // =========================================

    private fun isTimeMatch(current: LocalTime, target: LocalTime): Boolean {
        val currentMinutes = current.hour * 60 + current.minute
        val targetMinutes = target.hour * 60 + target.minute
        return currentMinutes == targetMinutes
    }

    private fun parseDayOfWeek(dayStr: String?): DayOfWeek? {
        if (dayStr == null) return null
        return when (dayStr.lowercase()) {
            "0", "sunday", "sun" -> DayOfWeek.SUNDAY
            "1", "monday", "mon" -> DayOfWeek.MONDAY
            "2", "tuesday", "tue" -> DayOfWeek.TUESDAY
            "3", "wednesday", "wed" -> DayOfWeek.WEDNESDAY
            "4", "thursday", "thu" -> DayOfWeek.THURSDAY
            "5", "friday", "fri" -> DayOfWeek.FRIDAY
            "6", "saturday", "sat" -> DayOfWeek.SATURDAY
            else -> dayStr.toIntOrNull()?.let {
                DayOfWeek.entries.getOrNull(it % 7)
            }
        }
    }

    private fun ResultRow.toResponse() = NotificationResponse(
        id = this[Notifications.id].toString(),
        type = this[Notifications.type],
        title = this[Notifications.title],
        message = this[Notifications.message],
        is_read = this[Notifications.isRead],
        created_at = this[Notifications.createdAt].toString(),
        read_at = this[Notifications.readAt]?.toString()
    )
}
