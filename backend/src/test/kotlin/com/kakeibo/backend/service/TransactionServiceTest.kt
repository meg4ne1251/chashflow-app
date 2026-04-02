package com.kakeibo.backend.service

import com.kakeibo.backend.db.Transactions
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.*
import kotlin.test.*

class TransactionServiceTest {
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var transactionTagRepository: TransactionTagRepository
    private lateinit var transactionHistoryRepository: TransactionHistoryRepository
    private lateinit var inputPatternRepository: InputPatternRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var accountRepository: AccountRepository
    private lateinit var budgetRepository: BudgetRepository
    private lateinit var tagRepository: TagRepository
    private lateinit var analyticsService: AnalyticsService
    private lateinit var sut: TransactionService

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")

    private fun validDate(): String = LocalDateTime.now().format(dateFormatter)

    @BeforeTest
    fun setUp() {
        transactionRepository = mockk(relaxed = true)
        transactionTagRepository = mockk(relaxed = true)
        transactionHistoryRepository = mockk(relaxed = true)
        inputPatternRepository = mockk(relaxed = true)
        categoryRepository = mockk(relaxed = true)
        accountRepository = mockk(relaxed = true)
        budgetRepository = mockk(relaxed = true)
        tagRepository = mockk(relaxed = true)
        analyticsService = mockk(relaxed = true)

        sut = TransactionService(
            transactionRepository,
            transactionTagRepository,
            transactionHistoryRepository,
            inputPatternRepository,
            categoryRepository,
            accountRepository,
            budgetRepository,
            tagRepository,
            analyticsService
        )
    }

    // ===========================
    // create() tests
    // ===========================

    @Test
    fun `create - should validate amount is positive`() {
        val request = TransactionRequest(
            type = "expense",
            amount = 0,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = validDate()
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `create - should validate amount is not negative`() {
        val request = TransactionRequest(
            type = "expense",
            amount = -1000,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = validDate()
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `create - should validate type is valid`() {
        val request = TransactionRequest(
            type = "invalid_type",
            amount = 1000,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = validDate()
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `create - should validate date format`() {
        val request = TransactionRequest(
            type = "expense",
            amount = 1000,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = "invalid-date"
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `create - should validate category_id format`() {
        val request = TransactionRequest(
            type = "expense",
            amount = 1000,
            account_id = UUID.randomUUID().toString(),
            category_id = "invalid-uuid",
            date = validDate()
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `create - should validate account_id format`() {
        val request = TransactionRequest(
            type = "expense",
            amount = 1000,
            account_id = "invalid-uuid",
            category_id = UUID.randomUUID().toString(),
            date = validDate()
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `create - should validate memo max length`() {
        val longMemo = "あ".repeat(501)
        val request = TransactionRequest(
            type = "expense",
            amount = 1000,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = validDate(),
            memo = longMemo
        )

        assertFailsWith<ValidationException> {
            sut.create(request, UUID.randomUUID().toString())
        }
    }

    // ===========================
    // getById() tests
    // ===========================

    @Test
    fun `getById - should throw NotFoundException when transaction not found`() {
        val txId = UUID.randomUUID().toString()
        every { transactionRepository.findById(UUID.fromString(txId)) } returns null

        assertFailsWith<NotFoundException> {
            sut.getById(txId)
        }
    }

    // ===========================
    // update() tests
    // ===========================

    @Test
    fun `update - should throw ValidationException when version is missing`() {
        val txId = UUID.randomUUID().toString()
        val request = TransactionRequest(
            type = "expense",
            amount = 1000,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = validDate(),
            version = null
        )

        assertFailsWith<ValidationException> {
            sut.update(txId, request, UUID.randomUUID().toString())
        }
    }

    @Test
    fun `update - should throw NotFoundException when transaction not found`() {
        val txId = UUID.randomUUID()
        every { transactionRepository.findById(txId) } returns null

        val request = TransactionRequest(
            type = "expense",
            amount = 1000,
            account_id = UUID.randomUUID().toString(),
            category_id = UUID.randomUUID().toString(),
            date = validDate(),
            version = 1
        )

        assertFailsWith<NotFoundException> {
            sut.update(txId.toString(), request, UUID.randomUUID().toString())
        }
    }

    // ===========================
    // delete() tests
    // ===========================

    @Test
    fun `delete - should throw NotFoundException when transaction not found`() {
        val txId = UUID.randomUUID()
        every { transactionRepository.findById(txId) } returns null

        assertFailsWith<NotFoundException> {
            sut.delete(txId.toString(), 1)
        }
    }

    @Test
    fun `delete - should throw ConflictException on version mismatch`() {
        val txId = UUID.randomUUID()
        val mockRow = mockk<ResultRow>(relaxed = true)
        every { mockRow[Transactions.date] } returns LocalDateTime.now()
        every { transactionRepository.findById(txId) } returns mockRow
        every { transactionRepository.softDelete(txId, 1) } returns false

        assertFailsWith<ConflictException> {
            sut.delete(txId.toString(), 1)
        }
    }

    @Test
    fun `delete - should soft delete transaction successfully`() {
        val txId = UUID.randomUUID()
        val mockRow = mockk<ResultRow>(relaxed = true)
        every { mockRow[Transactions.date] } returns LocalDateTime.now()
        every { transactionRepository.findById(txId) } returns mockRow
        every { transactionRepository.softDelete(txId, 1) } returns true

        sut.delete(txId.toString(), 1)

        verify { transactionRepository.softDelete(txId, 1) }
    }

    // ===========================
    // restore() tests
    // ===========================

    @Test
    fun `restore - should throw NotFoundException when transaction not found`() {
        val txId = UUID.randomUUID()
        every { transactionRepository.restore(txId) } returns false

        assertFailsWith<NotFoundException> {
            sut.restore(txId.toString())
        }
    }

    @Test
    fun `restore - should restore soft deleted transaction successfully`() {
        val txId = UUID.randomUUID()
        every { transactionRepository.restore(txId) } returns true

        sut.restore(txId.toString())

        verify { transactionRepository.restore(txId) }
    }
}
