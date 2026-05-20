package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.service.AccountService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.*
import kotlin.test.*

class AccountRoutesTest {

    private val accountService = mockk<AccountService>()

    private fun ApplicationTestBuilder.configureTestApp() {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        accountRoutes(accountService)
                    }
                }
            }
        }
    }

    @BeforeTest
    fun setUp() {
        clearMocks(accountService)
    }

    // =========================================================================
    // GET /accounts
    // =========================================================================

    @Test
    fun `GET accounts - should return 401 without auth`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/accounts")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `GET accounts - should return 200 with auth`() = testApplication {
        configureTestApp()
        val mockResponseList = listOf(
            AccountResponse(
                id = "00000000-0000-0000-0000-000000000001",
                name = "お財布",
                type = "cash",
                initial_balance = 5000L,
                currency = "JPY",
                sort_order = 1,
                balance = 5000L,
                version = 1,
                created_at = "2026-05-20T10:00:00Z",
                updated_at = "2026-05-20T10:00:00Z"
            )
        )
        every { accountService.getAll() } returns mockResponseList

        val response = client.get("/api/v1/accounts") {
            withTestAuth()
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("お財布"))
    }

    // =========================================================================
    // POST /accounts
    // =========================================================================

    @Test
    fun `POST accounts - should return 201 on success`() = testApplication {
        configureTestApp()
        val accountResponse = AccountResponse(
            id = "00000000-0000-0000-0000-000000000001",
            name = "銀行口座",
            type = "bank",
            initial_balance = 100000L,
            currency = "JPY",
            sort_order = 2,
            balance = 100000L,
            version = 1,
            created_at = "2026-05-20T10:00:00Z",
            updated_at = "2026-05-20T10:00:00Z"
        )
        every { accountService.create(any()) } returns accountResponse

        val response = client.post("/api/v1/accounts") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"銀行口座","type":"bank","initial_balance":100000}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("銀行口座"))
    }

    @Test
    fun `POST accounts - should return 400 when validation fails`() = testApplication {
        configureTestApp()
        every { accountService.create(any()) } throws ValidationException(
            "口座名は必須です",
            listOf(FieldError("name", "name は必須です"))
        )

        val response = client.post("/api/v1/accounts") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"","type":"bank","initial_balance":100000}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("name は必須です"))
    }

    // =========================================================================
    // DELETE /accounts/{id}
    // =========================================================================

    @Test
    fun `DELETE accounts - should return 204 on success`() = testApplication {
        configureTestApp()
        val targetId = "00000000-0000-0000-0000-000000000001"
        justRun { accountService.delete(targetId, 1) }

        val response = client.delete("/api/v1/accounts/$targetId?version=1") {
            withTestAuth()
        }

        assertEquals(HttpStatusCode.NoContent, response.status)
        verify { accountService.delete(targetId, 1) }
    }
}
