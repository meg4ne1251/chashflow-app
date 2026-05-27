package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.service.BudgetService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.*
import kotlin.test.*

class BudgetRoutesTest {

    private val budgetService = mockk<BudgetService>()

    private fun ApplicationTestBuilder.configureTestApp() {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        budgetRoutes(budgetService)
                    }
                }
            }
        }
    }

    @BeforeTest
    fun setUp() {
        clearMocks(budgetService)
    }

    private fun sampleBudget(id: String = "00000000-0000-0000-0000-000000000030") = BudgetResponse(
        id = id,
        category_id = "00000000-0000-0000-0000-000000000002",
        year_month = "2026-05",
        amount = 50000L,
        currency = "JPY",
        spent = 12000L,
        consumption_rate = 24.0,
        version = 1,
        created_at = "2026-05-01T00:00:00Z",
        updated_at = "2026-05-01T00:00:00Z"
    )

    // =========================================================================
    // GET /budgets
    // =========================================================================

    @Test
    fun `GET budgets - should return 401 without auth`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/budgets?year_month=2026-05")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `GET budgets - should return 200 for given year_month`() = testApplication {
        configureTestApp()
        every { budgetService.getByYearMonth("2026-05") } returns listOf(sampleBudget())

        val response = client.get("/api/v1/budgets?year_month=2026-05") { withTestAuth() }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("2026-05"))
        verify { budgetService.getByYearMonth("2026-05") }
    }

    @Test
    fun `GET budgets - should return 400 when year_month missing`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/budgets") { withTestAuth() }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("year_month"))
        verify(exactly = 0) { budgetService.getByYearMonth(any()) }
    }

    // =========================================================================
    // PUT /budgets (upsert)
    // =========================================================================

    @Test
    fun `PUT budgets - should return 200 on upsert`() = testApplication {
        configureTestApp()
        every { budgetService.upsert(any()) } returns listOf(sampleBudget())

        val response = client.put("/api/v1/budgets") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody(
                """{"budgets":[{"category_id":"00000000-0000-0000-0000-000000000002","year_month":"2026-05","amount":50000}]}"""
            )
        }

        assertEquals(HttpStatusCode.OK, response.status)
        verify { budgetService.upsert(any()) }
    }

    @Test
    fun `PUT budgets - should return 400 when validation fails`() = testApplication {
        configureTestApp()
        every { budgetService.upsert(any()) } throws ValidationException(
            "予算額が不正です",
            listOf(FieldError("amount", "amount は0以上で指定してください"))
        )

        val response = client.put("/api/v1/budgets") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody(
                """{"budgets":[{"category_id":"00000000-0000-0000-0000-000000000002","year_month":"2026-05","amount":-1}]}"""
            )
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("amount は0以上"))
    }

    // =========================================================================
    // DELETE /budgets/{id}
    // =========================================================================

    @Test
    fun `DELETE budgets - should return 204 on success`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000030"
        justRun { budgetService.delete(id, 1) }

        val response = client.delete("/api/v1/budgets/$id?version=1") { withTestAuth() }

        assertEquals(HttpStatusCode.NoContent, response.status)
        verify { budgetService.delete(id, 1) }
    }

    @Test
    fun `DELETE budgets - should return 400 for invalid uuid`() = testApplication {
        configureTestApp()
        val response = client.delete("/api/v1/budgets/not-a-uuid?version=1") { withTestAuth() }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        verify(exactly = 0) { budgetService.delete(any(), any()) }
    }
}
