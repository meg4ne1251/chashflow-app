package com.kakeibo.backend.scheduler

import com.kakeibo.backend.service.RecurringTransactionService
import kotlinx.coroutines.*
import org.slf4j.LoggerFactory
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Scheduler for automatically generating transactions from recurring transaction definitions.
 * Runs daily at 0:00 JST.
 * Retry: up to 3 attempts with 5-minute intervals on failure.
 *
 * @param recurringTransactionService service for executing due recurring transactions
 * @param dailyCleanupTasks additional maintenance tasks to run after the daily batch (e.g. token cleanup)
 */
class RecurringTransactionScheduler(
    private val recurringTransactionService: RecurringTransactionService,
    private val dailyCleanupTasks: List<() -> Unit> = emptyList()
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var job: Job? = null
    @Volatile
    private var executionInProgress = false

    companion object {
        private const val MAX_RETRIES = 3
        private const val RETRY_INTERVAL_MINUTES = 5L
        private val TARGET_ZONE = ZoneId.of("Asia/Tokyo")
        private val TARGET_TIME = LocalTime.of(0, 0) // 0:00 JST
    }

    fun start() {
        logger.info("定期取引スケジューラを開始します")
        job = scope.launch {
            while (isActive) {
                try {
                    val delayMs = calculateDelayUntilNextExecution()
                    logger.info("次回の定期取引バッチ実行まで${delayMs / 1000}秒")
                    delay(delayMs)

                    executeWithRetry()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    logger.error("スケジューラの実行中にエラーが発生しました", e)
                    // Wait 1 hour before retrying the scheduler loop
                    delay(Duration.ofHours(1).toMillis())
                }
            }
        }
    }

    fun stop() {
        logger.info("定期取引スケジューラを停止します")
        job?.cancel()
        scope.cancel()
    }

    private suspend fun executeWithRetry() {
        // Prevent concurrent execution
        if (executionInProgress) {
            logger.warn("前回の実行がまだ進行中のため、今回の実行をスキップします")
            return
        }

        executionInProgress = true
        try {
            var retryCount = 0
            while (retryCount <= MAX_RETRIES) {
                try {
                    val today = LocalDate.now(TARGET_ZONE)
                    logger.info("定期取引バッチを実行します (日付: $today, リトライ: $retryCount)")
                    val created = recurringTransactionService.executeDueTransactions(today)
                    logger.info("定期取引バッチ完了: ${created}件生成")

                    // Run daily maintenance tasks (e.g. expired token cleanup)
                    dailyCleanupTasks.forEach { task ->
                        try {
                            task()
                        } catch (e: Exception) {
                            logger.warn("デイリークリーンアップタスクでエラーが発生しました", e)
                        }
                    }
                    return
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    retryCount++
                    if (retryCount > MAX_RETRIES) {
                        logger.error("定期取引バッチが${MAX_RETRIES}回リトライ後も失敗しました", e)
                        return
                    }
                    logger.warn("定期取引バッチ失敗 (リトライ $retryCount/$MAX_RETRIES): ${e.message}")
                    delay(Duration.ofMinutes(RETRY_INTERVAL_MINUTES).toMillis())
                }
            }
        } finally {
            executionInProgress = false
        }
    }

    private fun calculateDelayUntilNextExecution(): Long {
        val now = ZonedDateTime.now(TARGET_ZONE)
        var nextExecution = ZonedDateTime.of(now.toLocalDate(), TARGET_TIME, TARGET_ZONE)
        if (now.isAfter(nextExecution)) {
            nextExecution = nextExecution.plusDays(1)
        }
        return Duration.between(now, nextExecution).toMillis().coerceAtLeast(1000)
    }
}
