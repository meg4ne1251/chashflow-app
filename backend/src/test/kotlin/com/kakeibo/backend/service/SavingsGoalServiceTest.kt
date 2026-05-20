package com.kakeibo.backend.service

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.SavingsGoals
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class SavingsGoalServiceTest {
    private lateinit var savingsGoalRepository: SavingsGoalRepository
    private lateinit var accountRepository: AccountRepository
    private lateinit var transferRepository: TransferRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var notificationSettingRepository: NotificationSettingRepository
    private lateinit var sut: SavingsGoalService

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        savingsGoalRepository = mockk(relaxed = true)
        accountRepository = mockk(relaxed = true)
        transferRepository = mockk(relaxed = true)
        notificationRepository = mockk(relaxed = true)
        notificationSettingRepository = mockk(relaxed = true)

        sut = SavingsGoalService(
            savingsGoalRepository,
            accountRepository,
            transferRepository,
            notificationRepository,
            notificationSettingRepository
        )
    }

    // =========================================================================
    // Helper Methods to create stubbed ResultRows without Mockk ClassCastException
    // =========================================================================

    private fun createMockSavingsGoalRow(
        id: UUID = UUID.randomUUID(),
        name: String = "貯蓄目標",
        targetAmount: Long = 100000L,
        currentAmount: Long = 0L,
        currency: String = "JPY",
        deadline: LocalDate? = null,
        accountId: UUID? = null,
        icon: String? = null,
        color: String? = null,
        sortOrder: Int = 1,
        status: String = "active",
        version: Int = 1,
        achievedAt: OffsetDateTime? = null,
        createdAt: OffsetDateTime = OffsetDateTime.now(),
        updatedAt: OffsetDateTime = OffsetDateTime.now(),
        deletedAt: OffsetDateTime? = null
    ): ResultRow {
        val mock = mockk<ResultRow>()
        every { mock[SavingsGoals.id] } returns id
        every { mock[SavingsGoals.name] } returns name
        every { mock[SavingsGoals.targetAmount] } returns targetAmount
        every { mock[SavingsGoals.currentAmount] } returns currentAmount
        every { mock[SavingsGoals.currency] } returns currency
        every { mock[SavingsGoals.deadline] } returns deadline
        every { mock[SavingsGoals.accountId] } returns accountId
        every { mock[SavingsGoals.icon] } returns icon
        every { mock[SavingsGoals.color] } returns color
        every { mock[SavingsGoals.sortOrder] } returns sortOrder
        every { mock[SavingsGoals.status] } returns status
        every { mock[SavingsGoals.version] } returns version
        every { mock[SavingsGoals.achievedAt] } returns achievedAt
        every { mock[SavingsGoals.createdAt] } returns createdAt
        every { mock[SavingsGoals.updatedAt] } returns updatedAt
        every { mock[SavingsGoals.deletedAt] } returns deletedAt
        return mock
    }

    private fun createMockAccountRow(
        id: UUID = UUID.randomUUID(),
        name: String = "決済口座",
        type: String = "cash",
        initialBalance: Long = 0L,
        currency: String = "JPY",
        sortOrder: Int = 1,
        paymentDay: Int? = null,
        version: Int = 1,
        createdAt: OffsetDateTime = OffsetDateTime.now(),
        updatedAt: OffsetDateTime = OffsetDateTime.now(),
        deletedAt: OffsetDateTime? = null
    ): ResultRow {
        val mock = mockk<ResultRow>()
        every { mock[Accounts.id] } returns id
        every { mock[Accounts.name] } returns name
        every { mock[Accounts.type] } returns type
        every { mock[Accounts.initialBalance] } returns initialBalance
        every { mock[Accounts.currency] } returns currency
        every { mock[Accounts.sortOrder] } returns sortOrder
        every { mock[Accounts.paymentDay] } returns paymentDay
        every { mock[Accounts.version] } returns version
        every { mock[Accounts.createdAt] } returns createdAt
        every { mock[Accounts.updatedAt] } returns updatedAt
        every { mock[Accounts.deletedAt] } returns deletedAt
        return mock
    }

    // =========================================================================
    // create()
    // =========================================================================

    @Test
    fun `create - should validate name is not blank`() {
        val request = SavingsGoalRequest(
            name = "",
            target_amount = 10000,
            currency = "JPY"
        )
        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate target_amount is positive`() {
        val request = SavingsGoalRequest(
            name = "旅行資金",
            target_amount = 0,
            currency = "JPY"
        )
        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate color code format`() {
        val request = SavingsGoalRequest(
            name = "旅行資金",
            target_amount = 10000,
            currency = "JPY",
            color = "invalid-color"
        )
        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should succeed with valid parameters`() {
        val request = SavingsGoalRequest(
            name = "旅行資金",
            target_amount = 100000,
            currency = "JPY",
            deadline = "2026-12-31",
            color = "#FF0000",
            icon = "star"
        )

        val goalId = UUID.randomUUID()
        val mockRow = createMockSavingsGoalRow(
            id = goalId,
            name = "旅行資金",
            targetAmount = 100000L,
            deadline = LocalDate.parse("2026-12-31"),
            color = "#FF0000",
            icon = "star"
        )

        every {
            savingsGoalRepository.create(
                id = any(), name = "旅行資金", targetAmount = 100000L, currentAmount = 0L,
                currency = "JPY", deadline = any(), accountId = any(), icon = "star",
                color = "#FF0000", sortOrder = any()
            )
        } returns mockRow

        val response = sut.create(request)
        assertEquals("旅行資金", response.name)
        assertEquals(100000L, response.target_amount)
        assertEquals(0L, response.current_amount)
    }

    // =========================================================================
    // update()
    // =========================================================================

    @Test
    fun `update - should throw ConflictException when update returns null`() {
        val goalId = UUID.randomUUID()
        val request = SavingsGoalRequest(
            name = "車購入",
            target_amount = 2000000,
            currency = "JPY",
            version = 1
        )

        val mockGoal = createMockSavingsGoalRow(
            id = goalId,
            name = "古い名前",
            targetAmount = 2000000L,
            currentAmount = 50000L,
            accountId = UUID.randomUUID()
        )

        every { savingsGoalRepository.findActiveById(goalId) } returns mockGoal
        every {
            savingsGoalRepository.update(
                id = goalId, name = any(), targetAmount = any(), currentAmount = any(),
                currency = any(), deadline = any(), accountId = any(), icon = any(),
                color = any(), sortOrder = any(), currentVersion = 1
            )
        } returns null

        assertFailsWith<ConflictException> {
            sut.update(goalId.toString(), request)
        }
    }

    // =========================================================================
    // deposit()
    // =========================================================================

    @Test
    fun `deposit - should throw ValidationException for invalid source account`() {
        val goalId = UUID.randomUUID()
        val request = SavingsDepositRequest(
            from_account_id = "invalid-uuid",
            amount = 5000,
            date = "2026-05-20"
        )

        val goalRow = createMockSavingsGoalRow(
            id = goalId,
            accountId = UUID.randomUUID()
        )
        every { savingsGoalRepository.findActiveById(goalId) } returns goalRow

        assertFailsWith<ValidationException> {
            sut.deposit(goalId.toString(), request)
        }
    }

    @Test
    fun `deposit - should succeed and compute new balance`() {
        val goalId = UUID.randomUUID()
        val sourceAccountId = UUID.randomUUID()
        val savingsAccountId = UUID.randomUUID()

        val goalRow = createMockSavingsGoalRow(
            id = goalId,
            name = "マイ貯金",
            accountId = savingsAccountId,
            currency = "JPY",
            version = 1
        )

        val sourceAccount = createMockAccountRow(id = sourceAccountId)
        val savingsAccount = createMockAccountRow(id = savingsAccountId, type = "savings")

        every { savingsGoalRepository.findActiveById(goalId) } returns goalRow
        every { accountRepository.findActiveById(sourceAccountId) } returns sourceAccount
        every { accountRepository.findById(savingsAccountId) } returns savingsAccount

        every { transferRepository.sumByAccountDirection(savingsAccountId, "to") } returns 5000L
        every { transferRepository.sumByAccountDirection(savingsAccountId, "from") } returns 0L

        val updatedGoalRow = createMockSavingsGoalRow(
            id = goalId,
            name = "マイ貯金",
            accountId = savingsAccountId,
            targetAmount = 10000L,
            currentAmount = 5000L,
            status = "active"
        )

        every { savingsGoalRepository.updateCurrentAmount(goalId, 5000L, 1) } returns updatedGoalRow

        val request = SavingsDepositRequest(
            from_account_id = sourceAccountId.toString(),
            amount = 5000L,
            date = "2026-05-20"
        )

        val response = sut.deposit(goalId.toString(), request)
        assertEquals(5000L, response.current_amount)
        verify {
            transferRepository.create(
                id = any(),
                fromAccountId = sourceAccountId,
                toAccountId = savingsAccountId,
                amount = 5000L,
                currency = "JPY",
                date = LocalDate.parse("2026-05-20"),
                memo = any()
            )
        }
    }

    // =========================================================================
    // delete()
    // =========================================================================

    @Test
    fun `delete - should throw ConflictException when delete fails`() {
        val goalId = UUID.randomUUID()
        val mockGoal = createMockSavingsGoalRow(
            id = goalId,
            accountId = null
        )

        every { savingsGoalRepository.findActiveById(goalId) } returns mockGoal
        every { savingsGoalRepository.softDelete(goalId, 1) } returns false

        assertFailsWith<ConflictException> {
            sut.delete(goalId.toString(), 1)
        }
    }

    @Test
    fun `delete - should succeed and soft delete linked account`() {
        val goalId = UUID.randomUUID()
        val accountId = UUID.randomUUID()

        val mockGoal = createMockSavingsGoalRow(
            id = goalId,
            accountId = accountId
        )

        val mockAccount = createMockAccountRow(
            id = accountId,
            type = "savings",
            version = 2
        )

        every { savingsGoalRepository.findActiveById(goalId) } returns mockGoal
        every { savingsGoalRepository.softDelete(goalId, 1) } returns true
        every { accountRepository.findActiveById(accountId) } returns mockAccount

        sut.delete(goalId.toString(), 1)

        verify {
            savingsGoalRepository.softDelete(goalId, 1)
            accountRepository.softDelete(accountId, 2)
        }
    }
}
