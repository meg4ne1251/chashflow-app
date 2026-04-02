package com.kakeibo.backend.integration

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.*
import com.kakeibo.backend.repository.*
import com.kakeibo.backend.service.*
import com.kakeibo.shared.model.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.*
import kotlin.test.*

class TransactionIntegrationTest {
    private lateinit var transactionService: TransactionService
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var accountRepository: AccountRepository
    private lateinit var userId: UUID
    private lateinit var categoryId: UUID
    private lateinit var accountId: UUID

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")

    private fun validDate(offsetDays: Long = 0): String =
        LocalDateTime.now().minusDays(offsetDays).format(dateFormatter)

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        TestHelper.cleanDatabase()

        // リポジトリ作成
        val userRepository = UserRepository()
        accountRepository = AccountRepository()
        val categoryRepository = CategoryRepository()
        transactionRepository = TransactionRepository()
        val transactionTagRepository = TransactionTagRepository()
        val transactionHistoryRepository = TransactionHistoryRepository()
        val inputPatternRepository = InputPatternRepository()
        val budgetRepository = BudgetRepository()
        val tagRepository = TagRepository()

        // サービス作成（analyticsServiceはnullでも可）
        transactionService = TransactionService(
            transactionRepository,
            transactionTagRepository,
            transactionHistoryRepository,
            inputPatternRepository,
            categoryRepository,
            accountRepository,
            budgetRepository,
            tagRepository,
            null  // analyticsService
        )

        // テストデータ作成
        transaction {
            val user = userRepository.create("testuser", "hashedpassword")
            userId = user.id

            val catRow = categoryRepository.create(
                id = UUID.randomUUID(),
                name = "食費",
                type = "expense",
                icon = "restaurant",
                color = "#FF0000",
                sortOrder = 1
            )
            categoryId = catRow[Categories.id]

            val accRow = accountRepository.create(
                id = UUID.randomUUID(),
                name = "現金",
                type = "cash",
                initialBalance = 100000,
                currency = "JPY",
                sortOrder = 1,
                paymentDay = null
            )
            accountId = accRow[Accounts.id]
        }
    }

    /** 残高計算ヘルパー */
    private fun getAccountBalance(accountId: UUID): Long {
        val account = accountRepository.findById(accountId)!!
        val initialBalance = account[Accounts.initialBalance]
        val income = transactionRepository.sumByAccountAndType(accountId, "income")
        val expense = transactionRepository.sumByAccountAndType(accountId, "expense")
        return initialBalance + income - expense
    }

    @Test
    fun `creating expense should decrease account balance`() {
        // Arrange
        val initialBalance = getAccountBalance(accountId)
        assertEquals(100000L, initialBalance)

        // Act
        transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 1500,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate()
            ),
            userId.toString()
        )

        // Assert
        val newBalance = getAccountBalance(accountId)
        assertEquals(98500L, newBalance)
    }

    @Test
    fun `creating income should increase account balance`() {
        // Arrange
        val initialBalance = getAccountBalance(accountId)

        // Act
        transactionService.create(
            TransactionRequest(
                type = "income",
                amount = 50000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate()
            ),
            userId.toString()
        )

        // Assert
        val newBalance = getAccountBalance(accountId)
        assertEquals(initialBalance + 50000, newBalance)
    }

    @Test
    fun `multiple transactions should be reflected in balance`() {
        // Arrange
        val initialBalance = getAccountBalance(accountId)

        // Act - 複数の取引を作成
        transactionService.create(
            TransactionRequest(
                type = "income",
                amount = 30000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate()
            ),
            userId.toString()
        )

        transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 5000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate()
            ),
            userId.toString()
        )

        transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 2000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate()
            ),
            userId.toString()
        )

        // Assert
        val newBalance = getAccountBalance(accountId)
        assertEquals(initialBalance + 30000 - 5000 - 2000, newBalance)
    }

    @Test
    fun `deleting and restoring transaction should restore balance`() {
        // Arrange
        val tx = transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 3000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate()
            ),
            userId.toString()
        )
        val balanceAfterCreate = getAccountBalance(accountId)
        assertEquals(97000L, balanceAfterCreate)

        // Act - Delete
        transactionService.delete(tx.id, tx.version)
        val balanceAfterDelete = getAccountBalance(accountId)
        assertEquals(100000L, balanceAfterDelete)

        // Act - Restore
        transactionService.restore(tx.id)
        val balanceAfterRestore = getAccountBalance(accountId)
        assertEquals(97000L, balanceAfterRestore)
    }

    @Test
    fun `getById should return created transaction`() {
        // Arrange
        val memo = "テストメモ"
        val tx = transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 2500,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate(),
                memo = memo
            ),
            userId.toString()
        )

        // Act
        val retrieved = transactionService.getById(tx.id)

        // Assert
        assertEquals(tx.id, retrieved.id)
        assertEquals(2500, retrieved.amount)
        assertEquals("expense", retrieved.type)
        assertEquals(memo, retrieved.memo)
    }

    @Test
    fun `getAll should return paginated transactions`() {
        // Arrange - 5つの取引を作成
        repeat(5) { i ->
            transactionService.create(
                TransactionRequest(
                    type = "expense",
                    amount = (1000 + i * 100).toLong(),
                    account_id = accountId.toString(),
                    category_id = categoryId.toString(),
                    date = validDate(i.toLong()),
                    memo = "取引$i"
                ),
                userId.toString()
            )
        }

        // Act
        val result = transactionService.getAll(
            dateFrom = null,
            dateTo = null,
            type = null,
            categoryId = null,
            accountId = null,
            tagIds = null,
            keyword = null,
            page = 1,
            size = 3,
            sort = null
        )

        // Assert
        assertEquals(3, result.data.size)
        assertEquals(5L, result.pagination.total_count)
        assertEquals(2, result.pagination.total_pages)
    }

    @Test
    fun `getAll should filter by keyword`() {
        // Arrange
        transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 1000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate(),
                memo = "ランチ代"
            ),
            userId.toString()
        )
        transactionService.create(
            TransactionRequest(
                type = "expense",
                amount = 2000,
                account_id = accountId.toString(),
                category_id = categoryId.toString(),
                date = validDate(),
                memo = "ディナー代"
            ),
            userId.toString()
        )

        // Act
        val result = transactionService.getAll(
            dateFrom = null,
            dateTo = null,
            type = null,
            categoryId = null,
            accountId = null,
            tagIds = null,
            keyword = "ランチ",
            page = 1,
            size = 50,
            sort = null
        )

        // Assert
        assertEquals(1, result.data.size)
        assertEquals("ランチ代", result.data[0].memo)
    }
}
