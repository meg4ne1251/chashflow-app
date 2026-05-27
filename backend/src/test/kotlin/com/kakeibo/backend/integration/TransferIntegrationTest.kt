package com.kakeibo.backend.integration

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.*
import com.kakeibo.backend.middleware.ConflictException
import com.kakeibo.backend.middleware.NotFoundException
import com.kakeibo.backend.repository.AccountRepository
import com.kakeibo.backend.repository.TransferRepository
import com.kakeibo.backend.service.TransferService
import com.kakeibo.shared.model.TransferRequest
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.util.*
import kotlin.test.*

/**
 * TransferService を実 H2 データベースに対して検証する統合テスト。
 * リポジトリ層の transaction{} を含む書き込み・楽観ロック・論理削除/復元の経路を通す。
 */
class TransferIntegrationTest {
    private lateinit var transferService: TransferService
    private lateinit var fromAccountId: UUID
    private lateinit var toAccountId: UUID

    private val today: String = LocalDate.now().toString()

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        TestHelper.cleanDatabase()

        val accountRepository = AccountRepository()
        transferService = TransferService(TransferRepository())

        transaction {
            fromAccountId = accountRepository.create(
                id = UUID.randomUUID(),
                name = "現金",
                type = "cash",
                initialBalance = 100000,
                currency = "JPY",
                sortOrder = 1,
                paymentDay = null
            )[Accounts.id]

            toAccountId = accountRepository.create(
                id = UUID.randomUUID(),
                name = "銀行",
                type = "bank",
                initialBalance = 0,
                currency = "JPY",
                sortOrder = 2,
                paymentDay = null
            )[Accounts.id]
        }
    }

    private fun newTransfer(amount: Long = 20000L, memo: String? = "引き出し") = TransferRequest(
        from_account_id = fromAccountId.toString(),
        to_account_id = toAccountId.toString(),
        amount = amount,
        currency = "JPY",
        date = today,
        memo = memo
    )

    @Test
    fun `create then getById returns persisted transfer`() {
        val created = transferService.create(newTransfer())

        val fetched = transferService.getById(created.id)
        assertEquals(created.id, fetched.id)
        assertEquals(fromAccountId.toString(), fetched.from_account_id)
        assertEquals(toAccountId.toString(), fetched.to_account_id)
        assertEquals(20000L, fetched.amount)
        assertEquals("引き出し", fetched.memo)
        assertEquals(1, fetched.version)
    }

    @Test
    fun `getAll returns paginated transfers`() {
        repeat(3) { i -> transferService.create(newTransfer(amount = (1000L + i * 500))) }

        val result = transferService.getAll(
            dateFrom = null, dateTo = null, accountId = null, page = 1, size = 2
        )

        assertEquals(2, result.data.size)
        assertEquals(3L, result.pagination.total_count)
        assertEquals(2, result.pagination.total_pages)
    }

    @Test
    fun `getAll filters by account id`() {
        transferService.create(newTransfer())

        val matching = transferService.getAll(
            dateFrom = null, dateTo = null, accountId = fromAccountId.toString(), page = 1, size = 50
        )
        assertEquals(1, matching.data.size)

        val unrelated = transferService.getAll(
            dateFrom = null, dateTo = null, accountId = UUID.randomUUID().toString(), page = 1, size = 50
        )
        assertEquals(0, unrelated.data.size)
    }

    @Test
    fun `update with correct version bumps version`() {
        val created = transferService.create(newTransfer(amount = 5000L))

        val updated = transferService.update(
            created.id,
            newTransfer(amount = 7500L).copy(version = created.version)
        )

        assertEquals(7500L, updated.amount)
        assertEquals(created.version + 1, updated.version)
    }

    @Test
    fun `update with stale version throws conflict`() {
        val created = transferService.create(newTransfer())

        assertFailsWith<ConflictException> {
            transferService.update(
                created.id,
                newTransfer(amount = 999L).copy(version = created.version + 99)
            )
        }
    }

    @Test
    fun `delete then getById throws NotFound and restore recovers it`() {
        val created = transferService.create(newTransfer())

        transferService.delete(created.id, created.version)
        assertFailsWith<NotFoundException> { transferService.getById(created.id) }

        transferService.restore(created.id)
        val restored = transferService.getById(created.id)
        assertEquals(created.id, restored.id)
    }

    @Test
    fun `delete with stale version throws conflict`() {
        val created = transferService.create(newTransfer())

        assertFailsWith<ConflictException> {
            transferService.delete(created.id, created.version + 50)
        }
    }
}
