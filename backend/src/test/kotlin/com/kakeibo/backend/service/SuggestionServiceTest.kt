package com.kakeibo.backend.service

import com.kakeibo.backend.db.InputPatterns
import com.kakeibo.backend.repository.InputPatternRepository
import com.kakeibo.backend.repository.TransactionRepository
import io.mockk.every
import io.mockk.mockk
import org.jetbrains.exposed.sql.ResultRow
import java.util.*
import kotlin.test.*

class SuggestionServiceTest {
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var inputPatternRepository: InputPatternRepository
    private lateinit var sut: SuggestionService

    @BeforeTest
    fun setUp() {
        transactionRepository = mockk(relaxed = true)
        inputPatternRepository = mockk(relaxed = true)
        sut = SuggestionService(transactionRepository, inputPatternRepository)
    }

    // ===== getMemoSuggestions =====

    @Test
    fun `getMemoSuggestions - blank keyword returns empty without querying`() {
        assertEquals(emptyList(), sut.getMemoSuggestions("   "))
    }

    @Test
    fun `getMemoSuggestions - maps memos with frequency`() {
        every { transactionRepository.getDistinctMemos("スーパー", 10) } returns listOf(
            "スーパーA" to 5L,
            "スーパーB" to 2L
        )

        val result = sut.getMemoSuggestions("スーパー")

        assertEquals(2, result.size)
        assertEquals("スーパーA", result[0].memo)
        assertEquals(5, result[0].frequency)
        assertEquals(2, result[1].frequency)
    }

    // ===== getAutoComplete =====

    @Test
    fun `getAutoComplete - blank memo returns zero confidence`() {
        val result = sut.getAutoComplete("")
        assertNull(result.category_id)
        assertNull(result.account_id)
        assertEquals(0.0, result.confidence)
    }

    @Test
    fun `getAutoComplete - exact match confidence capped at 1`() {
        val categoryId = UUID.randomUUID()
        val accountId = UUID.randomUUID()
        every { inputPatternRepository.findByKeyword("コンビニ") } returns
            mockPatternRow(categoryId, accountId, hitCount = 10)

        val result = sut.getAutoComplete("コンビニ")

        assertEquals(categoryId.toString(), result.category_id)
        assertEquals(accountId.toString(), result.account_id)
        assertEquals(1.0, result.confidence)  // minOf(1.0, 10/5.0)
    }

    @Test
    fun `getAutoComplete - exact match confidence scales with hit count`() {
        val categoryId = UUID.randomUUID()
        every { inputPatternRepository.findByKeyword("カフェ") } returns
            mockPatternRow(categoryId, null, hitCount = 2)

        val result = sut.getAutoComplete("カフェ")

        assertEquals(0.4, result.confidence)  // 2/5.0
        assertNull(result.account_id)
    }

    @Test
    fun `getAutoComplete - falls back to prefix match with capped confidence`() {
        val categoryId = UUID.randomUUID()
        every { inputPatternRepository.findByKeyword("ス") } returns null
        every { inputPatternRepository.searchByKeyword("ス", 1) } returns listOf(
            mockPatternRow(categoryId, null, hitCount = 20)
        )

        val result = sut.getAutoComplete("ス")

        assertEquals(categoryId.toString(), result.category_id)
        assertEquals(0.8, result.confidence)  // minOf(0.8, 20/10.0)
    }

    @Test
    fun `getAutoComplete - no match returns zero confidence`() {
        every { inputPatternRepository.findByKeyword(any()) } returns null
        every { inputPatternRepository.searchByKeyword(any(), any()) } returns emptyList()

        val result = sut.getAutoComplete("未知の店")

        assertNull(result.category_id)
        assertEquals(0.0, result.confidence)
    }

    private fun mockPatternRow(categoryId: UUID?, accountId: UUID?, hitCount: Int): ResultRow {
        val row = mockk<ResultRow>(relaxed = true)
        every { row[InputPatterns.categoryId] } returns categoryId
        every { row[InputPatterns.accountId] } returns accountId
        every { row[InputPatterns.hitCount] } returns hitCount
        return row
    }
}
