package com.kakeibo.backend.integration

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.*
import com.kakeibo.backend.repository.*
import com.kakeibo.backend.service.RecurringTransactionService
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.util.*
import kotlin.test.*

/**
 * executeDueTransactions の「結線」を検証する統合テスト。
 *
 * calculateNextExecutionDate 単体の振る舞いは [com.kakeibo.backend.service.RecurringTransactionServiceTest]
 * で網羅しているが、ここでは executeDueTransactions が **startDate を anchorDate として読み出している**
 * ことを実 DB 経由で保証する。これがリグレッションすると（例: anchor に nextExecutionDate を誤って渡す）、
 * 月末取引が一度丸められた日付に固定されてドリフトするが、単体テストだけでは検知できない。
 */
class RecurringTransactionExecutionIntegrationTest {
    private lateinit var sut: RecurringTransactionService
    private lateinit var recurringTransactionRepository: RecurringTransactionRepository
    private lateinit var categoryId: UUID
    private lateinit var accountId: UUID

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        TestHelper.cleanDatabase()

        recurringTransactionRepository = RecurringTransactionRepository()
        val recurringTransactionTagRepository = RecurringTransactionTagRepository()
        val transactionRepository = TransactionRepository()
        val transactionTagRepository = TransactionTagRepository()
        val tagRepository = TagRepository()
        val categoryRepository = CategoryRepository()
        val accountRepository = AccountRepository()

        sut = RecurringTransactionService(
            recurringTransactionRepository,
            recurringTransactionTagRepository,
            transactionRepository,
            transactionTagRepository,
            tagRepository
        )

        transaction {
            categoryId = categoryRepository.create(
                id = UUID.randomUUID(), name = "食費", type = "expense",
                icon = "restaurant", color = "#FF0000", sortOrder = 1
            )[Categories.id]
            accountId = accountRepository.create(
                id = UUID.randomUUID(), name = "現金", type = "cash",
                initialBalance = 100000, currency = "JPY", sortOrder = 1, paymentDay = null
            )[Accounts.id]
        }
    }

    private fun createMonthlyRecurring(
        startDate: LocalDate,
        nextExecutionDate: LocalDate,
        dayOfMonth: Int? = null,
        isActive: Boolean = true,
    ): UUID {
        val id = UUID.randomUUID()
        recurringTransactionRepository.create(
            id = id, type = "expense", amount = 1000, currency = "JPY",
            categoryId = categoryId, accountId = accountId, memo = null,
            frequency = "monthly", interval = 1,
            dayOfWeek = null, dayOfMonth = dayOfMonth, monthOfYear = null,
            startDate = startDate, endDate = null,
            nextExecutionDate = nextExecutionDate, isActive = isActive
        )
        return id
    }

    private fun nextExecutionDateOf(id: UUID): LocalDate =
        recurringTransactionRepository.findById(id)!![RecurringTransactions.nextExecutionDate]

    private fun transactionCount(): Long = transaction {
        Transactions.selectAll().count()
    }

    @Test
    fun `executeDueTransactions uses startDate as anchor so month-end does not drift`() {
        // 開始日 1/31、現在の次回実行日は 2/28（うるう年でない 2026 年で月末に丸められた状態）
        val id = createMonthlyRecurring(
            startDate = LocalDate.of(2026, 1, 31),
            nextExecutionDate = LocalDate.of(2026, 2, 28)
        )

        val created = sut.executeDueTransactions(LocalDate.of(2026, 2, 28))

        assertEquals(1, created)
        // anchor=startDate(31日) を基準にするため 3/31 に戻る。
        // もし fromDate(=2/28) を基準にしていたら 3/28 になり、以降ずっと28日に固定されてしまう。
        assertEquals(LocalDate.of(2026, 3, 31), nextExecutionDateOf(id))
    }

    @Test
    fun `executeDueTransactions generates a transaction dated at the due nextExecutionDate`() {
        createMonthlyRecurring(
            startDate = LocalDate.of(2026, 1, 15),
            nextExecutionDate = LocalDate.of(2026, 2, 15)
        )
        assertEquals(0L, transactionCount())

        val created = sut.executeDueTransactions(LocalDate.of(2026, 2, 15))

        assertEquals(1, created)
        assertEquals(1L, transactionCount())
        val txDate = transaction {
            Transactions.selectAll().single()[Transactions.date]
        }
        assertEquals(LocalDate.of(2026, 2, 15), txDate.toLocalDate())
    }

    @Test
    fun `executeDueTransactions skips entries whose nextExecutionDate is in the future`() {
        val id = createMonthlyRecurring(
            startDate = LocalDate.of(2026, 1, 15),
            nextExecutionDate = LocalDate.of(2026, 3, 15)
        )

        val created = sut.executeDueTransactions(LocalDate.of(2026, 2, 15))

        assertEquals(0, created)
        assertEquals(0L, transactionCount())
        // 次回実行日は据え置き
        assertEquals(LocalDate.of(2026, 3, 15), nextExecutionDateOf(id))
    }

    @Test
    fun `executeDueTransactions skips inactive entries`() {
        createMonthlyRecurring(
            startDate = LocalDate.of(2026, 1, 15),
            nextExecutionDate = LocalDate.of(2026, 2, 15),
            isActive = false
        )

        val created = sut.executeDueTransactions(LocalDate.of(2026, 2, 15))

        assertEquals(0, created)
        assertEquals(0L, transactionCount())
    }
}
