package com.kakeibo.backend.service

import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.AccountRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.backend.repository.TransferRepository
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.util.*
import kotlin.test.*

class AccountServiceTest {
    private lateinit var accountRepository: AccountRepository
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var transferRepository: TransferRepository
    private lateinit var sut: AccountService

    @BeforeTest
    fun setUp() {
        accountRepository = mockk(relaxed = true)
        transactionRepository = mockk(relaxed = true)
        transferRepository = mockk(relaxed = true)
        sut = AccountService(accountRepository, transactionRepository, transferRepository)
    }

    // ===========================
    // create() tests
    // ===========================

    @Test
    fun `create - should validate name is not blank`() {
        val request = AccountRequest(
            name = "",
            type = "cash",
            initial_balance = 0
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate name is not only whitespace`() {
        val request = AccountRequest(
            name = "   ",
            type = "cash",
            initial_balance = 0
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate type is valid`() {
        val request = AccountRequest(
            name = "テスト口座",
            type = "invalid_type",
            initial_balance = 0
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should reject savings type`() {
        val request = AccountRequest(
            name = "貯蓄口座",
            type = "savings",
            initial_balance = 0
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate name max length`() {
        val longName = "あ".repeat(101)
        val request = AccountRequest(
            name = longName,
            type = "cash",
            initial_balance = 0
        )

        val exception = assertFailsWith<ValidationException> {
            sut.create(request)
        }
        assertTrue(exception.details?.any { it.field == "name" } == true)
    }

    @Test
    fun `create - should reject duplicate name`() {
        val request = AccountRequest(
            name = "テスト口座",
            type = "cash",
            initial_balance = 0
        )

        every { accountRepository.existsByName("テスト口座") } returns true

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    // ===========================
    // update() tests
    // ===========================

    @Test
    fun `update - should throw ValidationException when version is missing`() {
        val accountId = UUID.randomUUID().toString()
        val request = AccountRequest(
            name = "更新口座",
            type = "cash",
            initial_balance = 10000,
            version = null
        )

        assertFailsWith<ValidationException> {
            sut.update(accountId, request)
        }
    }

    @Test
    fun `update - should reject duplicate name`() {
        val accountId = UUID.randomUUID()
        val request = AccountRequest(
            name = "既存の名前",
            type = "cash",
            initial_balance = 10000,
            version = 1
        )

        every { accountRepository.existsByName("既存の名前", accountId) } returns true

        assertFailsWith<ValidationException> {
            sut.update(accountId.toString(), request)
        }
    }

    @Test
    fun `update - should throw NotFoundException when account not found`() {
        val accountId = UUID.randomUUID()
        val request = AccountRequest(
            name = "更新口座",
            type = "cash",
            initial_balance = 10000,
            version = 1
        )

        every { accountRepository.existsByName(any(), any()) } returns false
        every { accountRepository.update(any(), any(), any(), any(), any(), any(), any(), any()) } returns null
        every { accountRepository.findById(accountId) } returns null

        assertFailsWith<NotFoundException> {
            sut.update(accountId.toString(), request)
        }
    }

    @Test
    fun `update - should throw ConflictException on version mismatch`() {
        val accountId = UUID.randomUUID()
        val request = AccountRequest(
            name = "更新口座",
            type = "cash",
            initial_balance = 10000,
            version = 1
        )

        val mockRow = mockk<ResultRow>(relaxed = true)
        every { accountRepository.existsByName(any(), any()) } returns false
        every { accountRepository.update(any(), any(), any(), any(), any(), any(), any(), any()) } returns null
        every { accountRepository.findById(accountId) } returns mockRow

        assertFailsWith<ConflictException> {
            sut.update(accountId.toString(), request)
        }
    }

    // ===========================
    // delete() tests
    // ===========================

    @Test
    fun `delete - should throw NotFoundException when account not found`() {
        val accountId = UUID.randomUUID()
        every { accountRepository.findActiveById(accountId) } returns null

        assertFailsWith<NotFoundException> {
            sut.delete(accountId.toString(), 1)
        }
    }

    @Test
    fun `delete - should reject deleting savings account`() {
        val accountId = UUID.randomUUID()
        val mockRow = mockk<ResultRow>(relaxed = true)
        every { mockRow[Accounts.type] } returns "savings"
        every { accountRepository.findActiveById(accountId) } returns mockRow

        assertFailsWith<ValidationException> {
            sut.delete(accountId.toString(), 1)
        }
    }

    @Test
    fun `delete - should throw ConflictException on version mismatch`() {
        val accountId = UUID.randomUUID()
        val mockRow = mockk<ResultRow>(relaxed = true)
        every { mockRow[Accounts.type] } returns "cash"
        every { accountRepository.findActiveById(accountId) } returns mockRow
        every { accountRepository.softDelete(accountId, 1) } returns false

        assertFailsWith<ConflictException> {
            sut.delete(accountId.toString(), 1)
        }
    }

    @Test
    fun `delete - should soft delete account successfully`() {
        val accountId = UUID.randomUUID()
        val mockRow = mockk<ResultRow>(relaxed = true)
        every { mockRow[Accounts.type] } returns "cash"
        every { accountRepository.findActiveById(accountId) } returns mockRow
        every { accountRepository.softDelete(accountId, 1) } returns true

        sut.delete(accountId.toString(), 1)

        verify { accountRepository.softDelete(accountId, 1) }
    }
}
