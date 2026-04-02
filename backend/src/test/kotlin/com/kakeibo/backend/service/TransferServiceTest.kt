package com.kakeibo.backend.service

import com.kakeibo.backend.db.Transfers
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.TransferRepository
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class TransferServiceTest {
    private lateinit var transferRepository: TransferRepository
    private lateinit var sut: TransferService

    @BeforeTest
    fun setUp() {
        transferRepository = mockk(relaxed = true)
        sut = TransferService(transferRepository)
    }

    // ===========================
    // create() tests
    // ===========================

    @Test
    fun `create - should validate from_account_id format`() {
        val request = TransferRequest(
            from_account_id = "invalid-uuid",
            to_account_id = UUID.randomUUID().toString(),
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate to_account_id format`() {
        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = "invalid-uuid",
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should reject same account for from and to`() {
        val sameAccountId = UUID.randomUUID().toString()
        val request = TransferRequest(
            from_account_id = sameAccountId,
            to_account_id = sameAccountId,
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate amount is positive`() {
        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = UUID.randomUUID().toString(),
            amount = 0,
            currency = "JPY",
            date = "2024-01-15"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate amount is not negative`() {
        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = UUID.randomUUID().toString(),
            amount = -1000,
            currency = "JPY",
            date = "2024-01-15"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate date format`() {
        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = UUID.randomUUID().toString(),
            amount = 1000,
            currency = "JPY",
            date = "invalid-date"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate memo length`() {
        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = UUID.randomUUID().toString(),
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15",
            memo = "a".repeat(501)  // 500文字超
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should create transfer successfully`() {
        val transferId = UUID.randomUUID()
        val fromAccountId = UUID.randomUUID()
        val toAccountId = UUID.randomUUID()
        val mockRow = createMockTransferRow(transferId, fromAccountId, toAccountId)

        every { transferRepository.create(any(), any(), any(), any(), any(), any(), any()) } returns mockRow

        val request = TransferRequest(
            from_account_id = fromAccountId.toString(),
            to_account_id = toAccountId.toString(),
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15",
            memo = "テスト振替"
        )

        val result = sut.create(request)

        assertEquals(transferId.toString(), result.id)
        assertEquals(fromAccountId.toString(), result.from_account_id)
        assertEquals(toAccountId.toString(), result.to_account_id)
        assertEquals(1000, result.amount)
    }

    // ===========================
    // getById() tests
    // ===========================

    @Test
    fun `getById - should throw NotFoundException when transfer not found`() {
        val transferId = UUID.randomUUID()
        every { transferRepository.findById(transferId) } returns null

        assertFailsWith<NotFoundException> {
            sut.getById(transferId.toString())
        }
    }

    @Test
    fun `getById - should throw NotFoundException when transfer is deleted`() {
        val transferId = UUID.randomUUID()
        val mockRow = createMockTransferRow(transferId, isDeleted = true)

        every { transferRepository.findById(transferId) } returns mockRow

        assertFailsWith<NotFoundException> {
            sut.getById(transferId.toString())
        }
    }

    @Test
    fun `getById - should return transfer when found`() {
        val transferId = UUID.randomUUID()
        val mockRow = createMockTransferRow(transferId)

        every { transferRepository.findById(transferId) } returns mockRow

        val result = sut.getById(transferId.toString())

        assertEquals(transferId.toString(), result.id)
    }

    // ===========================
    // update() tests
    // ===========================

    @Test
    fun `update - should require version`() {
        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = UUID.randomUUID().toString(),
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15",
            version = null
        )

        assertFailsWith<ValidationException> {
            sut.update(UUID.randomUUID().toString(), request)
        }
    }

    @Test
    fun `update - should throw ConflictException on version mismatch`() {
        val transferId = UUID.randomUUID()

        every { transferRepository.update(any(), any(), any(), any(), any(), any(), any(), any()) } returns null

        val request = TransferRequest(
            from_account_id = UUID.randomUUID().toString(),
            to_account_id = UUID.randomUUID().toString(),
            amount = 1000,
            currency = "JPY",
            date = "2024-01-15",
            version = 1
        )

        assertFailsWith<ConflictException> {
            sut.update(transferId.toString(), request)
        }
    }

    // ===========================
    // delete() tests
    // ===========================

    @Test
    fun `delete - should throw NotFoundException when transfer not found`() {
        val transferId = UUID.randomUUID()
        every { transferRepository.findById(transferId) } returns null

        assertFailsWith<NotFoundException> {
            sut.delete(transferId.toString(), 1)
        }
    }

    @Test
    fun `delete - should throw ConflictException on version mismatch`() {
        val transferId = UUID.randomUUID()
        val mockRow = createMockTransferRow(transferId)

        every { transferRepository.findById(transferId) } returns mockRow
        every { transferRepository.softDelete(transferId, 1) } returns false

        assertFailsWith<ConflictException> {
            sut.delete(transferId.toString(), 1)
        }
    }

    @Test
    fun `delete - should soft delete successfully`() {
        val transferId = UUID.randomUUID()
        val mockRow = createMockTransferRow(transferId)

        every { transferRepository.findById(transferId) } returns mockRow
        every { transferRepository.softDelete(transferId, 1) } returns true

        sut.delete(transferId.toString(), 1)

        verify { transferRepository.softDelete(transferId, 1) }
    }

    // ===========================
    // restore() tests
    // ===========================

    @Test
    fun `restore - should throw NotFoundException when transfer not found`() {
        val transferId = UUID.randomUUID()
        every { transferRepository.restore(transferId) } returns false

        assertFailsWith<NotFoundException> {
            sut.restore(transferId.toString())
        }
    }

    @Test
    fun `restore - should restore successfully`() {
        val transferId = UUID.randomUUID()
        every { transferRepository.restore(transferId) } returns true

        sut.restore(transferId.toString())

        verify { transferRepository.restore(transferId) }
    }

    // ===========================
    // getAll() tests
    // ===========================

    @Test
    fun `getAll - should return paginated response`() {
        val transferId = UUID.randomUUID()
        val mockRow = createMockTransferRow(transferId)

        every { transferRepository.findAll(any(), any(), any(), any(), any()) } returns Pair(listOf(mockRow), 1L)

        val result = sut.getAll(null, null, null, 1, 50)

        assertEquals(1, result.data.size)
        assertEquals(1, result.pagination.page)
        assertEquals(50, result.pagination.size)
        assertEquals(1, result.pagination.total_count)
    }

    // ===========================
    // Helper methods
    // ===========================

    private fun createMockTransferRow(
        id: UUID,
        fromAccountId: UUID = UUID.randomUUID(),
        toAccountId: UUID = UUID.randomUUID(),
        isDeleted: Boolean = false
    ): ResultRow {
        val mockRow = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()

        every { mockRow[Transfers.id] } returns id
        every { mockRow[Transfers.fromAccountId] } returns fromAccountId
        every { mockRow[Transfers.toAccountId] } returns toAccountId
        every { mockRow[Transfers.amount] } returns 1000
        every { mockRow[Transfers.currency] } returns "JPY"
        every { mockRow[Transfers.date] } returns LocalDate.of(2024, 1, 15)
        every { mockRow[Transfers.memo] } returns "テスト振替"
        every { mockRow[Transfers.version] } returns 1
        every { mockRow[Transfers.createdAt] } returns now
        every { mockRow[Transfers.updatedAt] } returns now
        every { mockRow[Transfers.deletedAt] } returns if (isDeleted) now else null

        return mockRow
    }
}
