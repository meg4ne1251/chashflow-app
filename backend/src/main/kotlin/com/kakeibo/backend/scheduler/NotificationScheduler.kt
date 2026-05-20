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
                val loopStart = java.time.ZonedDateTime.now()
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

                // ループ開始時の時刻を基準に次の「分」の開始境界 (xx:xx:00.000) を計算
                val nextMinute = loopStart.truncatedTo(java.time.temporal.ChronoUnit.MINUTES).plusMinutes(1)
                val now = java.time.ZonedDateTime.now()
                
                // 次の境界までのミリ秒数を計算
                var delayMs = java.time.Duration.between(now, nextMinute).toMillis()
                
                // もし処理自体に時間がかかり、既に次の境界を過ぎている場合、
                // または境界の直前（1秒未満）で終了した場合は、重複実行を防ぐため次の「分」までさらに1分待機する
                if (delayMs < 1000L) {
                    delayMs += CHECK_INTERVAL_MS
                }
                delay(delayMs)
            }
        }
    }

    fun stop() {
        logger.info("通知スケジューラを停止します")
        job?.cancel()
        scope.cancel()
    }
}
