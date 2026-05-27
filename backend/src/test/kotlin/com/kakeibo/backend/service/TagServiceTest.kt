package com.kakeibo.backend.service

import com.kakeibo.backend.db.Tags
import com.kakeibo.backend.middleware.ConflictException
import com.kakeibo.backend.middleware.NotFoundException
import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.RecurringTransactionTagRepository
import com.kakeibo.backend.repository.TagRepository
import com.kakeibo.backend.repository.TemplateTagRepository
import com.kakeibo.backend.repository.TransactionTagRepository
import com.kakeibo.shared.model.TagRequest
import io.mockk.every
import io.mockk.mockk
import org.jetbrains.exposed.sql.ResultRow
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class TagServiceTest {
    private lateinit var tagRepository: TagRepository
    private lateinit var transactionTagRepository: TransactionTagRepository
    private lateinit var templateTagRepository: TemplateTagRepository
    private lateinit var recurringTransactionTagRepository: RecurringTransactionTagRepository
    private lateinit var sut: TagService

    @BeforeTest
    fun setUp() {
        tagRepository = mockk(relaxed = true)
        transactionTagRepository = mockk(relaxed = true)
        templateTagRepository = mockk(relaxed = true)
        recurringTransactionTagRepository = mockk(relaxed = true)
        sut = TagService(
            tagRepository, transactionTagRepository,
            templateTagRepository, recurringTransactionTagRepository
        )
    }

    // ===== create =====

    @Test
    fun `create - rejects blank name`() {
        assertFailsWith<ValidationException> { sut.create(TagRequest(name = "  ")) }
    }

    @Test
    fun `create - rejects name exceeding max length`() {
        assertFailsWith<ValidationException> {
            sut.create(TagRequest(name = "a".repeat(51)))
        }
    }

    @Test
    fun `create - rejects invalid color`() {
        assertFailsWith<ValidationException> {
            sut.create(TagRequest(name = "食費", color = "not-a-color"))
        }
    }

    @Test
    fun `create - rejects duplicate name`() {
        every { tagRepository.existsByName("食費") } returns true
        assertFailsWith<ValidationException> {
            sut.create(TagRequest(name = "食費"))
        }
    }

    @Test
    fun `create - succeeds and trims name`() {
        val tagId = UUID.randomUUID()
        every { tagRepository.existsByName(any()) } returns false
        every { tagRepository.create(any(), "食費", any()) } returns mockTagRow(tagId, "食費")

        val result = sut.create(TagRequest(name = "  食費  ", color = "#FF0000"))

        assertEquals(tagId.toString(), result.id)
        assertEquals("食費", result.name)
    }

    // ===== update =====

    @Test
    fun `update - requires version`() {
        every { tagRepository.existsByName(any(), any()) } returns false
        assertFailsWith<ValidationException> {
            sut.update(UUID.randomUUID().toString(), TagRequest(name = "食費", version = null))
        }
    }

    @Test
    fun `update - rejects duplicate name for other tag`() {
        val id = UUID.randomUUID()
        every { tagRepository.existsByName("食費", id) } returns true
        assertFailsWith<ValidationException> {
            sut.update(id.toString(), TagRequest(name = "食費", version = 1))
        }
    }

    @Test
    fun `update - throws ConflictException on version mismatch`() {
        every { tagRepository.existsByName(any(), any()) } returns false
        every { tagRepository.update(any(), any(), any(), any()) } returns null
        assertFailsWith<ConflictException> {
            sut.update(UUID.randomUUID().toString(), TagRequest(name = "食費", version = 1))
        }
    }

    // ===== delete =====

    @Test
    fun `delete - throws NotFoundException when tag missing`() {
        every { tagRepository.findActiveById(any()) } returns null
        assertFailsWith<NotFoundException> {
            sut.delete(UUID.randomUUID().toString(), 1)
        }
    }

    private fun mockTagRow(id: UUID, name: String): ResultRow {
        val row = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()
        every { row[Tags.id] } returns id
        every { row[Tags.name] } returns name
        every { row[Tags.color] } returns "#FF0000"
        every { row[Tags.version] } returns 1
        every { row[Tags.createdAt] } returns now
        every { row[Tags.updatedAt] } returns now
        every { row[Tags.deletedAt] } returns null
        return row
    }
}
