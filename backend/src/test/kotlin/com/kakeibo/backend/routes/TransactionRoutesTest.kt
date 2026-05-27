package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.service.TransactionService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.*
import kotlin.test.*

class TransactionRoutesTest {

    private val transactionService = mockk<TransactionService>()

    private fun ApplicationTestBuilder.configureTestApp() {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }
    }

    @BeforeTest
    fun setUp() {
        clearMocks(transactionService)
    }

    private fun sampleTransaction(
        id: String = "00000000-0000-0000-0000-000000000010",
        memo: String? = "ランチ",
    ) = TransactionResponse(
        id = id,
        name = null,
        type = "expense",
        amount = 1500L,
        currency = "JPY",
        date = "2026-05-20T10:00:00",
        memo = memo,
        category_id = "00000000-0000-0000-0000-000000000002",
        account_id = "00000000-0000-0000-0000-000000000003",
        is_auto_generated = false,
        version = 1,
        created_at = "2026-05-20T10:00:00Z",
        updated_at = "2026-05-20T10:00:00Z"
    )

    // =========================================================================
    // GET /transactions
    // =========================================================================

    @Test
    fun `GET transactions - should return 401 without auth`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/transactions")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `GET transactions - should return 200 with paginated body`() = testApplication {
        configureTestApp()
        every {
            transactionService.getAll(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())
        } returns PaginatedResponse(
            data = listOf(sampleTransaction()),
            pagination = PaginationInfo(page = 1, size = 50, total_count = 1, total_pages = 1)
        )

        val response = client.get("/api/v1/transactions") { withTestAuth() }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("ランチ"))
    }

    @Test
    fun `GET transactions - should pass query filters to service`() = testApplication {
        configureTestApp()
        every {
            transactionService.getAll(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())
        } returns PaginatedResponse(emptyList(), PaginationInfo(page = 2, size = 10))

        client.get("/api/v1/transactions?type=expense&keyword=cafe&page=2&size=10") { withTestAuth() }

        verify {
            transactionService.getAll(
                null, null, "expense", null, null, null, "cafe", 2, 10, null
            )
        }
    }

    // =========================================================================
    // GET /transactions/{id}
    // =========================================================================

    @Test
    fun `GET transaction by id - should return 200`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"
        every { transactionService.getById(id) } returns sampleTransaction(id = id)

        val response = client.get("/api/v1/transactions/$id") { withTestAuth() }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains(id))
    }

    @Test
    fun `GET transaction by id - should return 400 for invalid uuid`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/transactions/not-a-uuid") { withTestAuth() }
        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `GET transaction by id - should return 404 when not found`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000099"
        every { transactionService.getById(id) } throws NotFoundException("取引が見つかりません")

        val response = client.get("/api/v1/transactions/$id") { withTestAuth() }
        assertEquals(HttpStatusCode.NotFound, response.status)
    }

    // =========================================================================
    // POST /transactions
    // =========================================================================

    @Test
    fun `POST transactions - should return 201 on success and pass userId`() = testApplication {
        configureTestApp()
        every {
            transactionService.create(any(), RouteTestHelper.testUserId.toString())
        } returns sampleTransaction()

        val response = client.post("/api/v1/transactions") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"type":"expense","amount":1500,"date":"2026-05-20T10:00:00","memo":"ランチ"}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        verify { transactionService.create(any(), RouteTestHelper.testUserId.toString()) }
    }

    @Test
    fun `POST transactions - should return 400 when validation fails`() = testApplication {
        configureTestApp()
        every { transactionService.create(any(), any()) } throws ValidationException(
            "金額は必須です",
            listOf(FieldError("amount", "amount は必須です"))
        )

        val response = client.post("/api/v1/transactions") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"type":"expense","amount":0,"date":"2026-05-20T10:00:00"}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("amount は必須です"))
    }

    // =========================================================================
    // PUT /transactions/{id}
    // =========================================================================

    @Test
    fun `PUT transactions - should return 200 on success`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"
        every {
            transactionService.update(id, any(), RouteTestHelper.testUserId.toString())
        } returns sampleTransaction(id = id)

        val response = client.put("/api/v1/transactions/$id") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"type":"expense","amount":2000,"date":"2026-05-20T10:00:00","version":1}""")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        verify { transactionService.update(id, any(), RouteTestHelper.testUserId.toString()) }
    }

    @Test
    fun `PUT transactions - should return 409 on version conflict`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"
        every { transactionService.update(id, any(), any()) } throws ConflictException(
            "バージョンが競合しました"
        )

        val response = client.put("/api/v1/transactions/$id") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"type":"expense","amount":2000,"date":"2026-05-20T10:00:00","version":1}""")
        }

        assertEquals(HttpStatusCode.Conflict, response.status)
    }

    // =========================================================================
    // DELETE /transactions/{id}
    // =========================================================================

    @Test
    fun `DELETE transactions - should return 204 on success`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"
        justRun { transactionService.delete(id, 1) }

        val response = client.delete("/api/v1/transactions/$id?version=1") { withTestAuth() }

        assertEquals(HttpStatusCode.NoContent, response.status)
        verify { transactionService.delete(id, 1) }
    }

    @Test
    fun `DELETE transactions - should return 400 when version missing`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"

        val response = client.delete("/api/v1/transactions/$id") { withTestAuth() }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        verify(exactly = 0) { transactionService.delete(any(), any()) }
    }

    // =========================================================================
    // PATCH /transactions/{id}/restore
    // =========================================================================

    @Test
    fun `PATCH restore - should return 200 with status restored`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"
        justRun { transactionService.restore(id) }

        val response = client.patch("/api/v1/transactions/$id/restore") { withTestAuth() }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("restored"))
        verify { transactionService.restore(id) }
    }

    // =========================================================================
    // GET /transactions/{id}/history
    // =========================================================================

    @Test
    fun `GET history - should return 200 with history list`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000010"
        every { transactionService.getHistory(id) } returns listOf(
            TransactionHistoryResponse(
                id = "00000000-0000-0000-0000-000000000020",
                transaction_id = id,
                user_id = RouteTestHelper.testUserId.toString(),
                changed_fields = """{"amount":[1500,2000]}""",
                changed_at = "2026-05-20T10:00:00Z",
                version_before = 1,
                version_after = 2
            )
        )

        val response = client.get("/api/v1/transactions/$id/history") { withTestAuth() }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("version_after"))
    }
}
