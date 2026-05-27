package com.kakeibo.backend.service

import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.SyncChange
import com.kakeibo.shared.model.SyncPushRequest
import io.mockk.mockk
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.test.*

class SyncServiceTest {
    private lateinit var sut: SyncService

    @BeforeTest
    fun setUp() {
        sut = SyncService(
            transactionRepository = mockk(relaxed = true),
            categoryRepository = mockk(relaxed = true),
            accountRepository = mockk(relaxed = true),
            tagRepository = mockk(relaxed = true),
            templateRepository = mockk(relaxed = true),
            recurringTransactionRepository = mockk(relaxed = true),
            budgetRepository = mockk(relaxed = true),
            transferRepository = mockk(relaxed = true),
            notificationSettingRepository = mockk(relaxed = true),
            inputPatternRepository = mockk(relaxed = true),
            accountService = mockk(relaxed = true)
        )
    }

    private fun change(
        entityType: String = "transaction",
        operation: String = "create",
        data: JsonObject = buildJsonObject {},
        clientVersion: Int = 0
    ) = SyncChange(entityType, operation, data, clientVersion)

    // ===== push =====

    @Test
    fun `push - rejects batch larger than max`() {
        val changes = List(101) { change() }
        assertFailsWith<ValidationException> {
            sut.push(SyncPushRequest(changes = changes))
        }
    }

    @Test
    fun `push - accepts batch at max boundary and returns one result per change`() {
        // 100件はサイズ検証を通過し、ValidationException を投げない。
        // （個々の処理失敗は per-change の結果に反映される: ここでは id 欠落で全件 error）
        val changes = List(100) { change(data = buildJsonObject {}) }
        val response = sut.push(SyncPushRequest(changes = changes))
        assertEquals(100, response.results.size)
        // 上限ちょうどは「拒否されない」ことを保証する。各 change が結果へマッピングされている。
        assertTrue(response.results.all { it.status == "error" })
    }

    @Test
    fun `push - missing id yields error result not exception`() {
        val response = sut.push(SyncPushRequest(changes = listOf(change(data = buildJsonObject {}))))
        assertEquals(1, response.results.size)
        assertEquals("error", response.results[0].status)
    }

    @Test
    fun `push - unknown operation yields error result`() {
        val data = buildJsonObject { put("id", "550e8400-e29b-41d4-a716-446655440000") }
        val response = sut.push(SyncPushRequest(changes = listOf(change(operation = "frobnicate", data = data))))
        assertEquals("error", response.results[0].status)
    }

    // ===== pull =====

    @Test
    fun `pull - rejects malformed since timestamp`() {
        assertFailsWith<ValidationException> {
            sut.pull("not-a-timestamp")
        }
    }

    @Test
    fun `pull - empty repositories return no data and has_more false`() {
        val response = sut.pull("2026-01-01T00:00:00Z")
        assertFalse(response.has_more)
        assertTrue(response.data.transactions.isEmpty())
        assertTrue(response.data.accounts.isEmpty())
        assertNotNull(response.sync_timestamp)
    }
}
