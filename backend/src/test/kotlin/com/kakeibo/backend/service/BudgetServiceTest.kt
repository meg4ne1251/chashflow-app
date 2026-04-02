package com.kakeibo.backend.service

import com.kakeibo.backend.db.Budgets
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.BudgetRepository
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class BudgetServiceTest {
    private lateinit var budgetRepository: BudgetRepository
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var sut: BudgetService

    @BeforeTest
    fun setUp() {
        budgetRepository = mockk(relaxed = true)
        transactionRepository = mockk(relaxed = true)
        categoryRepository = mockk(relaxed = true)
        sut = BudgetService(budgetRepository, transactionRepository, categoryRepository)
    }

    // ===========================
    // getByYearMonth() tests
    // ===========================

    @Test
    fun `getByYearMonth - should validate year_month format`() {
        assertFailsWith<ValidationException> {
            sut.getByYearMonth("invalid-format")
        }
    }

    @Test
    fun `getByYearMonth - should validate year_month with invalid month`() {
        assertFailsWith<ValidationException> {
            sut.getByYearMonth("2024-13")  // 13月は無効
        }
    }

    @Test
    fun `getByYearMonth - should validate year_month with invalid format`() {
        assertFailsWith<ValidationException> {
            sut.getByYearMonth("24-01")  // 2桁年は無効
        }
    }

    @Test
    fun `getByYearMonth - should return budgets with consumption rate`() {
        val budgetId = UUID.randomUUID()
        val categoryId = UUID.randomUUID()
        val budgetRow = createMockBudgetRow(budgetId, categoryId)
        val categoryRow = createMockCategoryRow(categoryId)

        every { budgetRepository.findByYearMonth("2024-01") } returns listOf(budgetRow)
        every { categoryRepository.findByIds(listOf(categoryId)) } returns listOf(categoryRow)
        every { transactionRepository.sumByCategoryAndMonth(categoryId, "2024-01") } returns 5000L

        val result = sut.getByYearMonth("2024-01")

        assertEquals(1, result.size)
        assertEquals(budgetId.toString(), result[0].id)
        assertEquals(10000L, result[0].amount)
        assertEquals(5000L, result[0].spent)
        assertEquals(50.0, result[0].consumption_rate)
    }

    @Test
    fun `getByYearMonth - should handle zero budget amount`() {
        val budgetId = UUID.randomUUID()
        val categoryId = UUID.randomUUID()
        val budgetRow = createMockBudgetRow(budgetId, categoryId, amount = 0)
        val categoryRow = createMockCategoryRow(categoryId)

        every { budgetRepository.findByYearMonth("2024-01") } returns listOf(budgetRow)
        every { categoryRepository.findByIds(listOf(categoryId)) } returns listOf(categoryRow)
        every { transactionRepository.sumByCategoryAndMonth(categoryId, "2024-01") } returns 0L

        val result = sut.getByYearMonth("2024-01")

        assertEquals(0.0, result[0].consumption_rate)
    }

    // ===========================
    // upsert() tests
    // ===========================

    @Test
    fun `upsert - should validate category_id format`() {
        val request = BudgetUpsertRequest(
            budgets = listOf(
                BudgetRequest(
                    category_id = "invalid-uuid",
                    year_month = "2024-01",
                    amount = 10000,
                    currency = "JPY"
                )
            )
        )

        assertFailsWith<ValidationException> {
            sut.upsert(request)
        }
    }

    @Test
    fun `upsert - should validate year_month format`() {
        val request = BudgetUpsertRequest(
            budgets = listOf(
                BudgetRequest(
                    category_id = UUID.randomUUID().toString(),
                    year_month = "invalid",
                    amount = 10000,
                    currency = "JPY"
                )
            )
        )

        assertFailsWith<ValidationException> {
            sut.upsert(request)
        }
    }

    @Test
    fun `upsert - should validate amount is positive`() {
        val request = BudgetUpsertRequest(
            budgets = listOf(
                BudgetRequest(
                    category_id = UUID.randomUUID().toString(),
                    year_month = "2024-01",
                    amount = 0,
                    currency = "JPY"
                )
            )
        )

        assertFailsWith<ValidationException> {
            sut.upsert(request)
        }
    }

    @Test
    fun `upsert - should validate amount is not negative`() {
        val request = BudgetUpsertRequest(
            budgets = listOf(
                BudgetRequest(
                    category_id = UUID.randomUUID().toString(),
                    year_month = "2024-01",
                    amount = -1000,
                    currency = "JPY"
                )
            )
        )

        assertFailsWith<ValidationException> {
            sut.upsert(request)
        }
    }

    @Test
    fun `upsert - should create or update budgets successfully`() {
        val budgetId = UUID.randomUUID()
        val categoryId = UUID.randomUUID()
        val budgetRow = createMockBudgetRow(budgetId, categoryId)
        val categoryRow = createMockCategoryRow(categoryId)

        every { budgetRepository.upsert(any(), any(), any(), any(), any()) } returns budgetRow
        every { categoryRepository.findByIds(listOf(categoryId)) } returns listOf(categoryRow)
        every { transactionRepository.sumByCategoryAndMonth(categoryId, "2024-01") } returns 0L

        val request = BudgetUpsertRequest(
            budgets = listOf(
                BudgetRequest(
                    category_id = categoryId.toString(),
                    year_month = "2024-01",
                    amount = 10000,
                    currency = "JPY"
                )
            )
        )

        val result = sut.upsert(request)

        assertEquals(1, result.size)
        verify { budgetRepository.upsert(any(), categoryId, "2024-01", 10000, "JPY") }
    }

    @Test
    fun `upsert - should handle multiple budgets`() {
        val budget1Id = UUID.randomUUID()
        val budget2Id = UUID.randomUUID()
        val category1Id = UUID.randomUUID()
        val category2Id = UUID.randomUUID()

        val budgetRow1 = createMockBudgetRow(budget1Id, category1Id)
        val budgetRow2 = createMockBudgetRow(budget2Id, category2Id)
        val categoryRow1 = createMockCategoryRow(category1Id)
        val categoryRow2 = createMockCategoryRow(category2Id)

        every { budgetRepository.upsert(any(), category1Id, any(), any(), any()) } returns budgetRow1
        every { budgetRepository.upsert(any(), category2Id, any(), any(), any()) } returns budgetRow2
        every { categoryRepository.findByIds(any()) } returns listOf(categoryRow1, categoryRow2)
        every { transactionRepository.sumByCategoryAndMonth(any(), any()) } returns 0L

        val request = BudgetUpsertRequest(
            budgets = listOf(
                BudgetRequest(
                    category_id = category1Id.toString(),
                    year_month = "2024-01",
                    amount = 10000,
                    currency = "JPY"
                ),
                BudgetRequest(
                    category_id = category2Id.toString(),
                    year_month = "2024-01",
                    amount = 20000,
                    currency = "JPY"
                )
            )
        )

        val result = sut.upsert(request)

        assertEquals(2, result.size)
    }

    // ===========================
    // delete() tests
    // ===========================

    @Test
    fun `delete - should throw NotFoundException when budget not found`() {
        val budgetId = UUID.randomUUID()
        every { budgetRepository.findById(budgetId) } returns null

        assertFailsWith<NotFoundException> {
            sut.delete(budgetId.toString(), 1)
        }
    }

    @Test
    fun `delete - should throw ConflictException on version mismatch`() {
        val budgetId = UUID.randomUUID()
        val mockRow = createMockBudgetRow(budgetId, UUID.randomUUID())

        every { budgetRepository.findById(budgetId) } returns mockRow
        every { budgetRepository.softDelete(budgetId, 1) } returns false

        assertFailsWith<ConflictException> {
            sut.delete(budgetId.toString(), 1)
        }
    }

    @Test
    fun `delete - should soft delete successfully`() {
        val budgetId = UUID.randomUUID()
        val mockRow = createMockBudgetRow(budgetId, UUID.randomUUID())

        every { budgetRepository.findById(budgetId) } returns mockRow
        every { budgetRepository.softDelete(budgetId, 1) } returns true

        sut.delete(budgetId.toString(), 1)

        verify { budgetRepository.softDelete(budgetId, 1) }
    }

    // ===========================
    // Helper methods
    // ===========================

    private fun createMockBudgetRow(
        id: UUID,
        categoryId: UUID,
        amount: Long = 10000
    ): ResultRow {
        val mockRow = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()

        every { mockRow[Budgets.id] } returns id
        every { mockRow[Budgets.categoryId] } returns categoryId
        every { mockRow[Budgets.yearMonth] } returns "2024-01"
        every { mockRow[Budgets.amount] } returns amount
        every { mockRow[Budgets.currency] } returns "JPY"
        every { mockRow[Budgets.version] } returns 1
        every { mockRow[Budgets.createdAt] } returns now
        every { mockRow[Budgets.updatedAt] } returns now
        every { mockRow[Budgets.deletedAt] } returns null

        return mockRow
    }

    private fun createMockCategoryRow(id: UUID): ResultRow {
        val mockRow = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()

        every { mockRow[Categories.id] } returns id
        every { mockRow[Categories.name] } returns "食費"
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
}
