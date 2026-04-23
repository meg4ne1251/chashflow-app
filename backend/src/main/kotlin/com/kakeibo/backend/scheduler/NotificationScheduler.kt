package com.kakeibo.backend.scheduler

import com.kakeibo.backend.service.NotificationService
import kotlinx.coroutines.*
import org.slf4j.LoggerFactory

/**
 * Scheduler for checking notification settings and generating notifications.
 * Runs every 60 seconds to check if input reminders or budget alerts should be sent.
 */
class NotificationScheduler(
    private val notificationService: NotificationService
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var job: Job? = null

    companion object {
        private const val CHECK_INTERVAL_MS = 60_000L // 1 minute
    }

    fun start() {
        logger.info("通知スケジューラを開始します")
        job = scope.launch {
            while (isActive) {
                try {
                    notificationService.checkAndGenerateInputReminder()
                    notificationService.checkAndGenerateBudgetAlerts()
                    notificationService.checkAndGenerateCreditCardPaymentReminders()
                    notificationService.checkAndGenerateCreditCardTransferReminders()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    logger.error("通知チェック中にエラーが発生しました", e)
                }
                delay(CHECK_INTERVAL_MS)
            }
        }
    }

    fun stop() {
        logger.info("通知スケジューラを停止します")
        job?.cancel()
        scope.cancel()
    }
}
