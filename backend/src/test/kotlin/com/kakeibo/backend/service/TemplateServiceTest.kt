package com.kakeibo.backend.service

import com.kakeibo.backend.middleware.ConflictException
import com.kakeibo.backend.middleware.NotFoundException
import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.TagRepository
import com.kakeibo.backend.repository.TemplateRepository
import com.kakeibo.backend.repository.TemplateTagRepository
import com.kakeibo.shared.model.TemplateRequest
import io.mockk.every
import io.mockk.mockk
import org.jetbrains.exposed.sql.ResultRow
import java.util.*
import kotlin.test.*

class TemplateServiceTest {
    private lateinit var templateRepository: TemplateRepository
    private lateinit var templateTagRepository: TemplateTagRepository
    private lateinit var tagRepository: TagRepository
    private lateinit var sut: TemplateService

    @BeforeTest
    fun setUp() {
        templateRepository = mockk(relaxed = true)
        templateTagRepository = mockk(relaxed = true)
        tagRepository = mockk(relaxed = true)
        sut = TemplateService(templateRepository, templateTagRepository, tagRepository)
    }

    // ===== create validation =====

    @Test
    fun `create - rejects blank name`() {
        assertFailsWith<ValidationException> {
            sut.create(TemplateRequest(name = "   ", type = "expense"))
        }
    }

    @Test
    fun `create - rejects name exceeding max length`() {
        assertFailsWith<ValidationException> {
            sut.create(TemplateRequest(name = "a".repeat(101), type = "expense"))
        }
    }

    @Test
    fun `create - rejects transaction_name exceeding max length`() {
        assertFailsWith<ValidationException> {
            sut.create(TemplateRequest(name = "ランチ", transaction_name = "a".repeat(101), type = "expense"))
        }
    }

    @Test
    fun `create - rejects invalid type`() {
        assertFailsWith<ValidationException> {
            sut.create(TemplateRequest(name = "ランチ", type = "invalid"))
        }
    }

    @Test
    fun `create - rejects amount over max`() {
        assertFailsWith<ValidationException> {
            sut.create(TemplateRequest(name = "ランチ", type = "expense", amount = 10_000_000_000L))
        }
    }

    @Test
    fun `create - rejects amount below min`() {
        assertFailsWith<ValidationException> {
            sut.create(TemplateRequest(name = "ランチ", type = "expense", amount = 0L))
        }
    }

    // ===== update validation =====

    @Test
    fun `update - requires version`() {
        assertFailsWith<ValidationException> {
            sut.update(UUID.randomUUID().toString(), TemplateRequest(name = "ランチ", type = "expense", version = null))
        }
    }

    // ===== recordUse =====

    @Test
    fun `recordUse - throws NotFoundException when template missing`() {
        every { templateRepository.findById(any()) } returns null
        assertFailsWith<NotFoundException> {
            sut.recordUse(UUID.randomUUID().toString())
        }
    }

    @Test
    fun `recordUse - increments use count when template exists`() {
        val id = UUID.randomUUID()
        every { templateRepository.findById(id) } returns mockk<ResultRow>(relaxed = true)
        every { templateRepository.incrementUseCount(id) } returns 1

        sut.recordUse(id.toString())

        io.mockk.verify { templateRepository.incrementUseCount(id) }
    }

    // ===== delete =====

    @Test
    fun `delete - throws NotFoundException when template missing`() {
        every { templateRepository.findById(any()) } returns null
        assertFailsWith<NotFoundException> {
            sut.delete(UUID.randomUUID().toString(), 1)
        }
    }

    @Test
    fun `delete - throws ConflictException on version mismatch`() {
        val id = UUID.randomUUID()
        every { templateRepository.findById(id) } returns mockk<ResultRow>(relaxed = true)
        every { templateRepository.softDelete(id, 1) } returns false
        assertFailsWith<ConflictException> {
            sut.delete(id.toString(), 1)
        }
    }
}
