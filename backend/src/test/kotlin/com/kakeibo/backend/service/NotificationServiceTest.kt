package com.kakeibo.backend.service

import com.kakeibo.backend.db.Budgets
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.db.NotificationSettings
import com.kakeibo.backend.db.Notifications
import com.kakeibo.backend.repository.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class NotificationServiceTest {
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var notificationSettingRepository: NotificationSettingRepository
    private lateinit var budgetRepository: BudgetRepository
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var accountRepository: AccountRepository
    private lateinit var sut: NotificationService

    @BeforeTest
    fun setUp() {
        notificationRepository = mockk(relaxed = true)
        notificationSettingRepository = mockk(relaxed = true)
        budgetRepository = mockk(relaxed = true)
        transactionRepository = mockk(relaxed = true)
        categoryRepository = mockk(relaxed = true)
        accountRepository = mockk(relaxed = true)
        sut = NotificationService(
            notificationRepository, notificationSettingRepository,
            budgetRepository, transactionRepository,
            categoryRepository, accountRepository
        )
    }

    // ===== Polling API =====

    @Test
    fun `getUnread - count equals number of rows`() {
        every { notificationRepository.findUnread() } returns listOf(
            mockNotificationRow(), mockNotificationRow()
        )
        val result = sut.getUnread()
        assertEquals(2, result.unread_count)
        assertEquals(2, result.notifications.size)
    }

    @Test
    fun `getRecent - uses countUnread for unread count`() {
        every { notificationRepository.findRecent() } returns listOf(mockNotificationRow())
        every { notificationRepository.countUnread() } returns 7L
        val result = sut.getRecent()
        assertEquals(7, result.unread_count)
        assertEquals(1, result.notifications.size)
    }

    @Test
    fun `getHistory - computes pagination metadata`() {
        every { notificationRepository.findAllPaginated(any(), any(), any(), any()) } returns
            Pair(emptyList(), 120L)
        val result = sut.getHistory(page = 1, size = 50)
        assertEquals(120L, result.pagination.total_count)
        assertEquals(3, result.pagination.total_pages)  // ceil(120/50)
        assertEquals(true, result.pagination.has_next)
    }

    @Test
    fun `getHistory - last page has no next`() {
        every { notificationRepository.findAllPaginated(any(), any(), any(), any()) } returns
            Pair(emptyList(), 100L)
        val result = sut.getHistory(page = 2, size = 50)
        assertEquals(2, result.pagination.total_pages)
        assertEquals(false, result.pagination.has_next)
    }

    @Test
    fun `markAllAsRead - delegates to repository`() {
        sut.markAllAsRead()
        verify { notificationRepository.markAllAsRead() }
    }

    // ===== Scheduler: input reminder =====

    @Test
    fun `checkAndGenerateInputReminder - no setting does nothing`() {
        every { notificationSettingRepository.findByType("input_remind") } returns null
        sut.checkAndGenerateInputReminder()
        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    @Test
    fun `checkAndGenerateInputReminder - disabled setting does nothing`() {
        every { notificationSettingRepository.findByType("input_remind") } returns
            mockSettingRow(isEnabled = false)
        sut.checkAndGenerateInputReminder()
        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    // ===== Scheduler: budget alerts =====

    @Test
    fun `checkAndGenerateBudgetAlerts - disabled does nothing`() {
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = false)
        sut.checkAndGenerateBudgetAlerts()
        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    @Test
    fun `checkAndGenerateBudgetAlerts - below threshold does not create`() {
        val catId = UUID.randomUUID()
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = true, thresholdPercent = 80)
        every { budgetRepository.findByYearMonth(any()) } returns listOf(mockBudgetRow(catId, 10_000))
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(catId to 5_000L)
        every { categoryRepository.findAll() } returns listOf(mockCategoryRow(catId, "食費"))

        sut.checkAndGenerateBudgetAlerts()

        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    @Test
    fun `checkAndGenerateBudgetAlerts - at or above threshold creates alert`() {
        val catId = UUID.randomUUID()
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = true, thresholdPercent = 80)
        every { budgetRepository.findByYearMonth(any()) } returns listOf(mockBudgetRow(catId, 10_000))
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(catId to 9_000L)
        every { categoryRepository.findAll() } returns listOf(mockCategoryRow(catId, "食費"))
        every { notificationRepository.existsTodayByTypeAndMessageContaining(any(), any()) } returns false

        sut.checkAndGenerateBudgetAlerts()

        verify(exactly = 1) {
            notificationRepository.create("budget_alert", any(), match { it.contains("食費") })
        }
    }

    @Test
    fun `checkAndGenerateBudgetAlerts - exactly at threshold creates alert`() {
        // 消化率がちょうど閾値（8000/10000 = 80.0%）のとき、`< threshold` は false なので生成される。
        // >= か > かを取り違えるオフバイワンを検知するための境界テスト。
        val catId = UUID.randomUUID()
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = true, thresholdPercent = 80)
        every { budgetRepository.findByYearMonth(any()) } returns listOf(mockBudgetRow(catId, 10_000))
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(catId to 8_000L)
        every { categoryRepository.findAll() } returns listOf(mockCategoryRow(catId, "食費"))
        every { notificationRepository.existsTodayByTypeAndMessageContaining(any(), any()) } returns false

        sut.checkAndGenerateBudgetAlerts()

        verify(exactly = 1) { notificationRepository.create("budget_alert", any(), any()) }
    }

    @Test
    fun `checkAndGenerateBudgetAlerts - just below threshold does not create`() {
        // 7999/10000 = 79.99% は閾値 80 未満なので生成されない。
        val catId = UUID.randomUUID()
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = true, thresholdPercent = 80)
        every { budgetRepository.findByYearMonth(any()) } returns listOf(mockBudgetRow(catId, 10_000))
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(catId to 7_999L)
        every { categoryRepository.findAll() } returns listOf(mockCategoryRow(catId, "食費"))

        sut.checkAndGenerateBudgetAlerts()

        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    @Test
    fun `checkAndGenerateBudgetAlerts - skips category with zero or negative budget`() {
        // budgetAmount <= 0 は continue されるため、消化率に関係なく生成されない（ゼロ除算回避の保証）。
        val catId = UUID.randomUUID()
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = true, thresholdPercent = 80)
        every { budgetRepository.findByYearMonth(any()) } returns listOf(mockBudgetRow(catId, 0))
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(catId to 5_000L)
        every { categoryRepository.findAll() } returns listOf(mockCategoryRow(catId, "食費"))

        sut.checkAndGenerateBudgetAlerts()

        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    @Test
    fun `checkAndGenerateBudgetAlerts - skips when alert already exists today`() {
        val catId = UUID.randomUUID()
        every { notificationSettingRepository.findByType("budget_alert") } returns
            mockSettingRow(isEnabled = true, thresholdPercent = 80)
        every { budgetRepository.findByYearMonth(any()) } returns listOf(mockBudgetRow(catId, 10_000))
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(catId to 9_000L)
        every { categoryRepository.findAll() } returns listOf(mockCategoryRow(catId, "食費"))
        every { notificationRepository.existsTodayByTypeAndMessageContaining(any(), any()) } returns true

        sut.checkAndGenerateBudgetAlerts()

        verify(exactly = 0) { notificationRepository.create(any(), any(), any()) }
    }

    @Test
    fun `cleanupOldNotifications - removes notifications older than 90 days`() {
        every { notificationRepository.deleteOlderThan(90) } returns 3
        sut.cleanupOldNotifications()
        verify { notificationRepository.deleteOlderThan(90) }
    }

    // ===== Helpers =====

    private fun mockNotificationRow(): ResultRow {
        val row = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()
        every { row[Notifications.id] } returns UUID.randomUUID()
        every { row[Notifications.type] } returns "input_remind"
        every { row[Notifications.title] } returns "タイトル"
        every { row[Notifications.message] } returns "メッセージ"
        every { row[Notifications.isRead] } returns false
        every { row[Notifications.createdAt] } returns now
        every { row[Notifications.readAt] } returns null
        return row
    }

    private fun mockSettingRow(isEnabled: Boolean, thresholdPercent: Int? = null): ResultRow {
        val row = mockk<ResultRow>(relaxed = true)
        every { row[NotificationSettings.isEnabled] } returns isEnabled
        every { row[NotificationSettings.thresholdPercent] } returns thresholdPercent
        every { row[NotificationSettings.frequency] } returns "daily"
        return row
    }

    private fun mockBudgetRow(categoryId: UUID, amount: Long): ResultRow {
        val row = mockk<ResultRow>(relaxed = true)
        every { row[Budgets.categoryId] } returns categoryId
        every { row[Budgets.amount] } returns amount
        return row
    }

    private fun mockCategoryRow(id: UUID, name: String): ResultRow {
        val row = mockk<ResultRow>(relaxed = true)
        every { row[Categories.id] } returns id
        every { row[Categories.name] } returns name
        return row
    }
}
