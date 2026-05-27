package com.kakeibo.backend.scheduler

import com.kakeibo.backend.service.RecurringTransactionService
import io.mockk.*
import kotlinx.coroutines.test.runTest
import java.time.Duration
import java.time.LocalDate
import kotlin.test.*

/**
 * RecurringTransactionScheduler の実行ロジック（成功・リトライ・クリーンアップ）のテスト。
 *
 * runTest により delay() は仮想時間で即座に消化されるため、リトライ間隔 (5分) を
 * 実時間で待たずにリトライ分岐を検証できる。
 */
class RecurringTransactionSchedulerTest {

    private val service = mockk<RecurringTransactionService>()

    @BeforeTest
    fun setUp() {
        clearMocks(service)
    }

    @Test
    fun `executeWithRetry runs the batch once on success`() = runTest {
        every { service.executeDueTransactions(any()) } returns 3

        val scheduler = RecurringTransactionScheduler(service)
        scheduler.executeWithRetry()

        verify(exactly = 1) { service.executeDueTransactions(any()) }
        assertFalse(scheduler.isExecuting(), "実行完了後は executionInProgress が false に戻るべき")
    }

    @Test
    fun `executeWithRetry uses today in target zone`() = runTest {
        val captured = slot<LocalDate>()
        every { service.executeDueTransactions(capture(captured)) } returns 0

        RecurringTransactionScheduler(service).executeWithRetry()

        // JST の「今日」を渡しているはず（UTC との境界誤差を避けて前後1日まで許容）
        val todayJst = LocalDate.now(java.time.ZoneId.of("Asia/Tokyo"))
        assertTrue(
            captured.captured in todayJst.minusDays(1)..todayJst.plusDays(1),
            "JST の今日付近の日付が渡されるべき: ${captured.captured}"
        )
    }

    @Test
    fun `executeWithRetry retries up to MAX_RETRIES then gives up`() = runTest {
        every { service.executeDueTransactions(any()) } throws RuntimeException("DB error")

        RecurringTransactionScheduler(service).executeWithRetry()

        // 初回 + 3リトライ = 4回呼ばれる
        verify(exactly = 4) { service.executeDueTransactions(any()) }
    }

    @Test
    fun `executeWithRetry succeeds after transient failures`() = runTest {
        every { service.executeDueTransactions(any()) } throws RuntimeException("transient") andThenThrows
            RuntimeException("transient") andThen 5

        RecurringTransactionScheduler(service).executeWithRetry()

        // 2回失敗 + 3回目で成功 = 3回
        verify(exactly = 3) { service.executeDueTransactions(any()) }
    }

    @Test
    fun `daily cleanup tasks run after a successful batch`() = runTest {
        every { service.executeDueTransactions(any()) } returns 1
        val task1 = mockk<() -> Unit>(relaxed = true)
        val task2 = mockk<() -> Unit>(relaxed = true)

        RecurringTransactionScheduler(service, listOf(task1, task2)).executeWithRetry()

        verify(exactly = 1) { task1.invoke() }
        verify(exactly = 1) { task2.invoke() }
    }

    @Test
    fun `a failing cleanup task does not abort the batch or other tasks`() = runTest {
        every { service.executeDueTransactions(any()) } returns 1
        val failing = mockk<() -> Unit>()
        every { failing.invoke() } throws RuntimeException("cleanup boom")
        val healthy = mockk<() -> Unit>(relaxed = true)

        RecurringTransactionScheduler(service, listOf(failing, healthy)).executeWithRetry()

        // バッチは成功扱い（リトライされない）、後続のクリーンアップタスクも実行される
        verify(exactly = 1) { service.executeDueTransactions(any()) }
        verify(exactly = 1) { healthy.invoke() }
    }

    @Test
    fun `cleanup tasks do not run when the batch ultimately fails`() = runTest {
        every { service.executeDueTransactions(any()) } throws RuntimeException("DB error")
        val task = mockk<() -> Unit>(relaxed = true)

        RecurringTransactionScheduler(service, listOf(task)).executeWithRetry()

        verify(exactly = 0) { task.invoke() }
    }

    @Test
    fun `calculateDelayUntilNextExecution is within the next 24 hours`() {
        val delay = RecurringTransactionScheduler(service).calculateDelayUntilNextExecution()

        assertTrue(delay >= 1000, "下限は 1000ms")
        assertTrue(delay <= Duration.ofHours(24).toMillis(), "次回実行は24時間以内")
    }

    @Test
    fun `lifecycle - isRunning reflects start and stop`() {
        every { service.executeDueTransactions(any()) } returns 0
        val scheduler = RecurringTransactionScheduler(service)

        assertFalse(scheduler.isRunning())
        scheduler.start()
        assertTrue(scheduler.isRunning())
        scheduler.stop()
        assertFalse(scheduler.isRunning())
    }
}
