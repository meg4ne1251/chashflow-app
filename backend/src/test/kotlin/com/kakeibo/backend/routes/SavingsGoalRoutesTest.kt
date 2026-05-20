package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.service.SavingsGoalService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.*
import kotlin.test.*

class SavingsGoalRoutesTest {

    private val savingsGoalService = mockk<SavingsGoalService>()

    private fun ApplicationTestBuilder.configureTestApp() {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        savingsGoalRoutes(savingsGoalService)
                    }
                }
            }
        }
    }

    @BeforeTest
    fun setUp() {
        clearMocks(savingsGoalService)
    }

    // =========================================================================
    // GET /savings-goals
    // =========================================================================

    @Test
    fun `GET savings-goals - should return 401 without auth`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/savings-goals")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `GET savings-goals - should return 200 with auth`() = testApplication {
        configureTestApp()
        val mockResponseList = listOf(
            SavingsGoalResponse(
                id = "00000000-0000-0000-0000-000000000001",
                name = "旅行",
                target_amount = 100000L,
                current_amount = 0L,
                currency = "JPY",
                deadline = null,
                account_id = null,
                account = null,
                icon = "flight",
                color = "#0000FF",
                sort_order = 1,
                status = "active",
                progress_rate = 0.0,
                remaining_amount = 100000L,
                monthly_recommended = null,
                achieved_at = null,
                version = 1,
                created_at = "2026-05-20T10:00:00Z",
                updated_at = "2026-05-20T10:00:00Z"
            )
        )
        every { savingsGoalService.getAll() } returns mockResponseList

        val response = client.get("/api/v1/savings-goals") {
            withTestAuth()
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("旅行"))
    }

    // =========================================================================
    // POST /savings-goals
    // =========================================================================

    @Test
    fun `POST savings-goals - should return 201 on success`() = testApplication {
        configureTestApp()
        val goalResponse = SavingsGoalResponse(
            id = "00000000-0000-0000-0000-000000000001",
            name = "マイカー",
            target_amount = 1500000L,
            current_amount = 0L,
            currency = "JPY",
            deadline = null,
            account_id = null,
            account = null,
            icon = "directions_car",
            color = "#FF0000",
            sort_order = 1,
            status = "active",
            progress_rate = 0.0,
            remaining_amount = 1500000L,
            monthly_recommended = null,
            achieved_at = null,
            version = 1,
            created_at = "2026-05-20T10:00:00Z",
            updated_at = "2026-05-20T10:00:00Z"
        )
        every { savingsGoalService.create(any()) } returns goalResponse

        val response = client.post("/api/v1/savings-goals") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"マイカー","target_amount":1500000,"currency":"JPY"}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("マイカー"))
    }

    @Test
    fun `POST savings-goals - should return 400 when validation fails`() = testApplication {
        configureTestApp()
        every { savingsGoalService.create(any()) } throws ValidationException(
            "目標名は必須です",
            listOf(FieldError("name", "name は必須です"))
        )

        val response = client.post("/api/v1/savings-goals") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"","target_amount":1500000,"currency":"JPY"}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("name は必須です"))
    }

    // =========================================================================
    // DELETE /savings-goals/{id}
    // =========================================================================

    @Test
    fun `DELETE savings-goals - should return 204 on success`() = testApplication {
        configureTestApp()
        val targetId = "00000000-0000-0000-0000-000000000001"
        justRun { savingsGoalService.delete(targetId, 1) }

        val response = client.delete("/api/v1/savings-goals/$targetId?version=1") {
            withTestAuth()
        }

        assertEquals(HttpStatusCode.NoContent, response.status)
        verify { savingsGoalService.delete(targetId, 1) }
    }
}
