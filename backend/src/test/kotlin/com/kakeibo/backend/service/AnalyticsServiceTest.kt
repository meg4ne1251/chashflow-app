package com.kakeibo.backend.service

import com.kakeibo.backend.db.Budgets
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.db.Transactions
import com.kakeibo.backend.repository.BudgetRepository
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class AnalyticsServiceTest {
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var budgetRepository: BudgetRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var accountService: AccountService
    private lateinit var savingsGoalService: SavingsGoalService
    private lateinit var sut: AnalyticsService

    @BeforeTest
    fun setUp() {
        transactionRepository = mockk(relaxed = true)
        budgetRepository = mockk(relaxed = true)
        categoryRepository = mockk(relaxed = true)
        accountService = mockk(relaxed = true)
        savingsGoalService = mockk(relaxed = true)

        sut = AnalyticsService(
            transactionRepository,
            budgetRepository,
            categoryRepository,
            accountService,
            savingsGoalService
        )

        // キャッシュをクリア
        sut.invalidateAllCache()
    }

    // ===========================
    // getDashboard() tests
    // ===========================

    @Test
    fun `getDashboard - should return dashboard with income and expense totals`() {
        every { transactionRepository.getMonthlySummary(any(), any()) } returns Pair(100000L, 50000L)
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns emptyMap()
        every { categoryRepository.findAll() } returns emptyList()
        every { budgetRepository.findByYearMonth(any()) } returns emptyList()
        every { transactionRepository.findRecentTransactions(any()) } returns emptyList()
        every { accountService.getAll() } returns emptyList()
        every { savingsGoalService.getActiveSummaries() } returns emptyList()

        val result = sut.getDashboard()

        assertEquals(100000L, result.income_total)
        assertEquals(50000L, result.expense_total)
        assertEquals(50000L, result.balance)
    }

    @Test
    fun `getDashboard - should return month over month comparison`() {
        // 今月: 収入10万、支出5万
        // 先月: 収入8万、支出6万
        every { transactionRepository.getMonthlySummary(any(), any()) } returnsMany listOf(
            Pair(100000L, 50000L),  // 今月
            Pair(80000L, 60000L)    // 先月
        )
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns emptyMap()
        every { categoryRepository.findAll() } returns emptyList()
        every { budgetRepository.findByYearMonth(any()) } returns emptyList()
        every { transactionRepository.findRecentTransactions(any()) } returns emptyList()
        every { accountService.getAll() } returns emptyList()
        every { savingsGoalService.getActiveSummaries() } returns emptyList()

        val result = sut.getDashboard()

        assertEquals(20000L, result.month_over_month.income_change)
        assertEquals(-10000L, result.month_over_month.expense_change)
        assertNotNull(result.month_over_month.income_change_rate)
        assertNotNull(result.month_over_month.expense_change_rate)
    }

    @Test
    fun `getDashboard - should return top 3 budget consumptions`() {
        val category1Id = UUID.randomUUID()
        val category2Id = UUID.randomUUID()
        val category3Id = UUID.randomUUID()
        val category4Id = UUID.randomUUID()

        val categoryRows = listOf(
            createMockCategoryRow(category1Id, "食費"),
            createMockCategoryRow(category2Id, "交通費"),
            createMockCategoryRow(category3Id, "娯楽"),
            createMockCategoryRow(category4Id, "光熱費")
        )

        val budgetRows = listOf(
            createMockBudgetRow(UUID.randomUUID(), category1Id, 10000),
            createMockBudgetRow(UUID.randomUUID(), category2Id, 5000),
            createMockBudgetRow(UUID.randomUUID(), category3Id, 20000),
            createMockBudgetRow(UUID.randomUUID(), category4Id, 15000)
        )

        every { transactionRepository.getMonthlySummary(any(), any()) } returns Pair(0L, 0L)
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns mapOf(
            category1Id to 9000L,   // 90%
            category2Id to 4000L,   // 80%
            category3Id to 25000L,  // 125%
            category4Id to 7500L    // 50%
        )
        every { categoryRepository.findAll() } returns categoryRows
        every { budgetRepository.findByYearMonth(any()) } returns budgetRows
        every { transactionRepository.findRecentTransactions(any()) } returns emptyList()
        every { accountService.getAll() } returns emptyList()
        every { savingsGoalService.getActiveSummaries() } returns emptyList()

        val result = sut.getDashboard()

        assertEquals(3, result.budget_consumption.size)
        // 消費率でソート（125%, 90%, 80%）
        assertEquals(125.0, result.budget_consumption[0].consumption_rate)
        assertEquals(90.0, result.budget_consumption[1].consumption_rate)
        assertEquals(80.0, result.budget_consumption[2].consumption_rate)
    }

    // ===========================
    // getCategoryBreakdown() tests
    // ===========================

    @Test
    fun `getCategoryBreakdown - should return breakdown for specified type`() {
        val categoryId = UUID.randomUUID()
        val categoryRow = createMockCategoryRow(categoryId, "食費")

        every { categoryRepository.findAll() } returns listOf(categoryRow)
        every { transactionRepository.getCategoryBreakdown(2024, 1, "expense") } returns listOf(
            Triple(categoryId, "食費", 10000L)
        )

        val result = sut.getCategoryBreakdown("2024-01", "expense")

        assertEquals("2024-01", result.year_month)
        assertEquals("expense", result.type)
        assertEquals(10000L, result.total)
        assertEquals(1, result.breakdown.size)
        assertEquals(100.0, result.breakdown[0].percentage)
    }

    @Test
    fun `getCategoryBreakdown - should default to expense type`() {
        every { categoryRepository.findAll() } returns emptyList()
        every { transactionRepository.getCategoryBreakdown(2024, 1, "expense") } returns emptyList()

        val result = sut.getCategoryBreakdown("2024-01", null)

        assertEquals("expense", result.type)
    }

    @Test
    fun `getCategoryBreakdown - should calculate percentage correctly`() {
        val category1Id = UUID.randomUUID()
        val category2Id = UUID.randomUUID()

        every { categoryRepository.findAll() } returns listOf(
            createMockCategoryRow(category1Id, "食費"),
            createMockCategoryRow(category2Id, "交通費")
        )
        every { transactionRepository.getCategoryBreakdown(2024, 1, "expense") } returns listOf(
            Triple(category1Id, "食費", 7500L),
            Triple(category2Id, "交通費", 2500L)
        )

        val result = sut.getCategoryBreakdown("2024-01", "expense")

        assertEquals(10000L, result.total)
        assertEquals(2, result.breakdown.size)
        assertEquals(75.0, result.breakdown[0].percentage)
        assertEquals(25.0, result.breakdown[1].percentage)
    }

    // ===========================
    // getComparison() tests
    // ===========================

    @Test
    fun `getComparison - should compare with previous month and year`() {
        // 今月（2024-01）: 収入10万、支出5万
        every { transactionRepository.getMonthlySummary(2024, 1) } returns Pair(100000L, 50000L)
        every { transactionRepository.getCategoryBreakdown(2024, 1, "expense") } returns emptyList()
        
        // 先月（2023-12）: 収入8万、支出4万
        every { transactionRepository.getMonthlySummary(2023, 12) } returns Pair(80000L, 40000L)
        every { transactionRepository.getCategoryBreakdown(2023, 12, "expense") } returns emptyList()
        
        // 前年同月（2023-01）: 収入7万、支出3万
        every { transactionRepository.getMonthlySummary(2023, 1) } returns Pair(70000L, 30000L)
        every { transactionRepository.getCategoryBreakdown(2023, 1, "expense") } returns emptyList()

        val result = sut.getComparison("2024-01")

        assertEquals("2024-01", result.year_month)
        assertEquals(100000L, result.current.income)
        assertEquals(80000L, result.previous_month.income)
        assertEquals(70000L, result.previous_year.income)

        // 前月比
        assertEquals(20000L, result.mom_change.income_change)
        assertEquals(10000L, result.mom_change.expense_change)

        // 前年比
        assertEquals(30000L, result.yoy_change.income_change)
        assertEquals(20000L, result.yoy_change.expense_change)
    }

    // ===========================
    // getYearlySummary() tests
    // ===========================

    @Test
    fun `getYearlySummary - should return yearly totals`() {
        every { transactionRepository.getYearlyMonthlySummary(2024) } returns mapOf(
            1 to Pair(100000L, 50000L),
            2 to Pair(110000L, 55000L),
            3 to Pair(105000L, 52000L)
        )
        every { transactionRepository.sumAllCategoriesByYear(2024) } returns emptyMap()
        every { categoryRepository.findAll() } returns emptyList()

        val result = sut.getYearlySummary(2024)

        assertEquals(2024, result.year)
        assertEquals(315000L, result.total_income)
        assertEquals(157000L, result.total_expense)
        assertEquals(158000L, result.total_savings)
        assertEquals(12, result.monthly.size)
    }

    @Test
    fun `getYearlySummary - should return monthly breakdown`() {
        every { transactionRepository.getYearlyMonthlySummary(2024) } returns mapOf(
            1 to Pair(100000L, 50000L)
        )
        every { transactionRepository.sumAllCategoriesByYear(2024) } returns emptyMap()
        every { categoryRepository.findAll() } returns emptyList()

        val result = sut.getYearlySummary(2024)

        assertEquals("2024-01", result.monthly[0].year_month)
        assertEquals(100000L, result.monthly[0].income)
        assertEquals(50000L, result.monthly[0].expense)
        assertEquals(50000L, result.monthly[0].balance)

        // 2月以降は0
        assertEquals(0L, result.monthly[1].income)
    }

    // ===========================
    // Cache tests
    // ===========================

    @Test
    fun `cache - should return cached result on second call`() {
        every { transactionRepository.getMonthlySummary(any(), any()) } returns Pair(100000L, 50000L)
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns emptyMap()
        every { categoryRepository.findAll() } returns emptyList()
        every { budgetRepository.findByYearMonth(any()) } returns emptyList()
        every { transactionRepository.findRecentTransactions(any()) } returns emptyList()
        every { accountService.getAll() } returns emptyList()
        every { savingsGoalService.getActiveSummaries() } returns emptyList()

        // 1回目
        sut.getDashboard()
        // 呼び出し回数をリセットせずに2回目
        clearMocks(transactionRepository, answers = false, recordedCalls = true, verificationMarks = true)
        
        // 2回目（キャッシュから取得）
        sut.getDashboard()

        // キャッシュから返されるため、2回目では呼ばれない
        verify(exactly = 0) { transactionRepository.getMonthlySummary(any(), any()) }
    }

    @Test
    fun `invalidateCache - should clear cache for specific yearMonth`() {
        every { transactionRepository.getMonthlySummary(any(), any()) } returns Pair(100000L, 50000L)
        every { transactionRepository.sumAllCategoriesByMonth(any()) } returns emptyMap()
        every { categoryRepository.findAll() } returns emptyList()
        every { budgetRepository.findByYearMonth(any()) } returns emptyList()
        every { transactionRepository.findRecentTransactions(any()) } returns emptyList()
        every { accountService.getAll() } returns emptyList()
        every { savingsGoalService.getActiveSummaries() } returns emptyList()

        // 1回目
        sut.getDashboard()
        
        // キャッシュ無効化（現在の年月を動的に取得）
        val now = java.time.LocalDate.now()
        val currentYearMonth = String.format("%04d-%02d", now.year, now.monthValue)
        sut.invalidateCache(currentYearMonth)
        
        // 呼び出し回数をリセット
        clearMocks(transactionRepository, answers = false, recordedCalls = true, verificationMarks = true)
        
        // 2回目（キャッシュが無効化されたので再度取得）
        sut.getDashboard()

        // リポジトリが再度呼ばれる（今月と先月の2回）
        verify(atLeast = 1) { transactionRepository.getMonthlySummary(any(), any()) }
    }

    // ===========================
    // Helper methods
    // ===========================

    private fun createMockCategoryRow(id: UUID, name: String): ResultRow {
        val mockRow = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()

        every { mockRow[Categories.id] } returns id
        every { mockRow[Categories.name] } returns name
        every { mockRow[Categories.type] } returns "expense"
        every { mockRow[Categories.icon] } returns "restaurant"
        every { mockRow[Categories.color] } returns "#FF0000"
        every { mockRow[Categories.sortOrder] } returns 1
        every { mockRow[Categories.isDefault] } returns false
        every { mockRow[Categories.version] } returns 1
        every { mockRow[Categories.createdAt] } returns now
        every { mockRow[Categories.updatedAt] } returns now
        every { mockRow[Categories.deletedAt] } returns null

        return mockRow
    }

    private fun createMockBudgetRow(id: UUID, categoryId: UUID, amount: Long): ResultRow {
        val mockRow = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()

        every { mockRow[Budgets.id] } returns id
        every { mockRow[Budgets.categoryId] } returns categoryId
        every { mockRow[Budgets.yearMonth] } returns "2026-04"
        every { mockRow[Budgets.amount] } returns amount
        every { mockRow[Budgets.currency] } returns "JPY"
        every { mockRow[Budgets.version] } returns 1
        every { mockRow[Budgets.createdAt] } returns now
        every { mockRow[Budgets.updatedAt] } returns now
        every { mockRow[Budgets.deletedAt] } returns null

        return mockRow
    }
}
