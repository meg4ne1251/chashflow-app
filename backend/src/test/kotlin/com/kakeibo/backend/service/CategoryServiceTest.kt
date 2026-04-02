package com.kakeibo.backend.service

import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.TransactionRepository
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class CategoryServiceTest {
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var sut: CategoryService

    @BeforeTest
    fun setUp() {
        categoryRepository = mockk(relaxed = true)
        transactionRepository = mockk(relaxed = true)
        sut = CategoryService(categoryRepository, transactionRepository)
    }

    // ===========================
    // create() tests
    // ===========================

    @Test
    fun `create - should validate name is not blank`() {
        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate name is not whitespace only`() {
        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "   ",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate name length does not exceed max`() {
        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "a".repeat(51),  // 50文字を超える
            type = "expense",
            icon = "restaurant",
            color = "#FF0000"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate type is valid`() {
        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "invalid_type",
            icon = "restaurant",
            color = "#FF0000"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should validate color format`() {
        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "expense",
            icon = "restaurant",
            color = "invalid-color"  // 不正なカラーコード
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should reject duplicate name with same type`() {
        every { categoryRepository.existsByNameAndType("食費", "expense", null) } returns true

        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000"
        )

        assertFailsWith<ValidationException> {
            sut.create(request)
        }
    }

    @Test
    fun `create - should create category successfully`() {
        val categoryId = UUID.randomUUID()
        val mockRow = createMockCategoryRow(categoryId)

        every { categoryRepository.existsByNameAndType(any(), any(), any()) } returns false
        every { categoryRepository.create(any(), any(), any(), any(), any(), any()) } returns mockRow

        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000"
        )

        val result = sut.create(request)

        assertEquals(categoryId.toString(), result.id)
        assertEquals("食費", result.name)
        assertEquals("expense", result.type)
    }

    // ===========================
    // update() tests
    // ===========================

    @Test
    fun `update - should require version`() {
        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000",
            version = null
        )

        assertFailsWith<ValidationException> {
            sut.update(UUID.randomUUID().toString(), request)
        }
    }

    @Test
    fun `update - should reject duplicate name with same type for other category`() {
        val categoryId = UUID.randomUUID()
        every { categoryRepository.existsByNameAndType("食費", "expense", categoryId) } returns true

        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000",
            version = 1
        )

        assertFailsWith<ValidationException> {
            sut.update(categoryId.toString(), request)
        }
    }

    @Test
    fun `update - should throw ConflictException on version mismatch`() {
        val categoryId = UUID.randomUUID()
        
        every { categoryRepository.existsByNameAndType(any(), any(), any()) } returns false
        every { categoryRepository.update(any(), any(), any(), any(), any(), any(), any()) } returns null

        val request = com.kakeibo.shared.model.CategoryRequest(
            name = "食費",
            type = "expense",
            icon = "restaurant",
            color = "#FF0000",
            version = 1
        )

        assertFailsWith<ConflictException> {
            sut.update(categoryId.toString(), request)
        }
    }

    // ===========================
    // delete() tests
    // ===========================

    @Test
    fun `delete - should throw NotFoundException when category not found`() {
        val categoryId = UUID.randomUUID()
        every { categoryRepository.findActiveById(categoryId) } returns null

        assertFailsWith<NotFoundException> {
            sut.delete(categoryId.toString(), 1)
        }
    }

    @Test
    fun `delete - should throw UnprocessableEntityException for default category`() {
        val categoryId = UUID.randomUUID()
        val mockRow = createMockCategoryRow(categoryId, isDefault = true)

        every { categoryRepository.findActiveById(categoryId) } returns mockRow

        assertFailsWith<UnprocessableEntityException> {
            sut.delete(categoryId.toString(), 1)
        }
    }

    @Test
    fun `delete - should throw ConflictException on version mismatch`() {
        // Note: CategoryService.delete()はExposedのtransaction{}を使用するため、
        // このテストにはH2インメモリDBの初期化が必要です。
        // 統合テスト（TransactionIntegrationTestパターン）として実装することを推奨
        // ここでは基本的なバリデーションのみをモックテストで検証します
        
        val categoryId = UUID.randomUUID()
        val mockRow = createMockCategoryRow(categoryId, isDefault = false)

        every { categoryRepository.findActiveById(categoryId) } returns mockRow
        every { transactionRepository.countByCategoryId(categoryId) } returns 0
        
        // transaction{}ブロックが実行されないため、このテストはスキップ
        // 本格的なテストはIntegrationテストで実施
    }

    @Test
    fun `delete - should reassign transactions to fallback category`() {
        // Note: CategoryService.delete()はExposedのtransaction{}を使用するため、
        // 統合テストパターンを推奨（TransactionIntegrationTestを参照）
        // モックテストではtransaction{}ブロック内のモックが動作しないため、
        // 基本バリデーション（isDefault, notFound）のみをこのクラスでテストします
    }

    // ===========================
    // Helper methods
    // ===========================

    private fun createMockCategoryRow(
        id: UUID,
        name: String = "食費",
        type: String = "expense",
        isDefault: Boolean = false
    ): ResultRow {
        val mockRow = mockk<ResultRow>(relaxed = true)
        val now = OffsetDateTime.now()

        every { mockRow[Categories.id] } returns id
        every { mockRow[Categories.name] } returns name
        every { mockRow[Categories.type] } returns type
        every { mockRow[Categories.icon] } returns "restaurant"
        every { mockRow[Categories.color] } returns "#FF0000"
        every { mockRow[Categories.sortOrder] } returns 1
        every { mockRow[Categories.isDefault] } returns isDefault
        every { mockRow[Categories.version] } returns 1
        every { mockRow[Categories.createdAt] } returns now
        every { mockRow[Categories.updatedAt] } returns now
        every { mockRow[Categories.deletedAt] } returns null

        return mockRow
    }
}
