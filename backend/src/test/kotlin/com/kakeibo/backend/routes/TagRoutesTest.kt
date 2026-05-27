package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.service.TagService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.*
import kotlin.test.*

class TagRoutesTest {

    private val tagService = mockk<TagService>()

    private fun ApplicationTestBuilder.configureTestApp() {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        tagRoutes(tagService)
                    }
                }
            }
        }
    }

    @BeforeTest
    fun setUp() {
        clearMocks(tagService)
    }

    private fun sampleTag(id: String = "00000000-0000-0000-0000-000000000040", name: String = "食費") =
        TagResponse(
            id = id,
            name = name,
            color = "#FF8800",
            version = 1,
            created_at = "2026-05-20T10:00:00Z",
            updated_at = "2026-05-20T10:00:00Z"
        )

    // =========================================================================
    // GET /tags
    // =========================================================================

    @Test
    fun `GET tags - should return 401 without auth`() = testApplication {
        configureTestApp()
        val response = client.get("/api/v1/tags")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `GET tags - should return 200 with list`() = testApplication {
        configureTestApp()
        every { tagService.getAll() } returns listOf(sampleTag())

        val response = client.get("/api/v1/tags") { withTestAuth() }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("食費"))
    }

    // =========================================================================
    // POST /tags
    // =========================================================================

    @Test
    fun `POST tags - should return 201 on success`() = testApplication {
        configureTestApp()
        every { tagService.create(any()) } returns sampleTag(name = "交通費")

        val response = client.post("/api/v1/tags") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"交通費","color":"#FF8800"}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("交通費"))
    }

    @Test
    fun `POST tags - should return 400 when validation fails`() = testApplication {
        configureTestApp()
        every { tagService.create(any()) } throws ValidationException(
            "タグ名は必須です",
            listOf(FieldError("name", "name は必須です"))
        )

        val response = client.post("/api/v1/tags") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":""}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("name は必須です"))
    }

    // =========================================================================
    // PUT /tags/{id}
    // =========================================================================

    @Test
    fun `PUT tags - should return 200 on success`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000040"
        every { tagService.update(id, any()) } returns sampleTag(id = id, name = "更新後")

        val response = client.put("/api/v1/tags/$id") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"更新後","version":1}""")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("更新後"))
        verify { tagService.update(id, any()) }
    }

    @Test
    fun `PUT tags - should return 400 for invalid uuid`() = testApplication {
        configureTestApp()
        val response = client.put("/api/v1/tags/not-a-uuid") {
            withTestAuth()
            contentType(ContentType.Application.Json)
            setBody("""{"name":"x","version":1}""")
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        verify(exactly = 0) { tagService.update(any(), any()) }
    }

    // =========================================================================
    // DELETE /tags/{id}
    // =========================================================================

    @Test
    fun `DELETE tags - should return 204 on success`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000040"
        every { tagService.delete(id, 1) } returns mapOf("status" to "deleted")

        val response = client.delete("/api/v1/tags/$id?version=1") { withTestAuth() }

        assertEquals(HttpStatusCode.NoContent, response.status)
        verify { tagService.delete(id, 1) }
    }

    @Test
    fun `DELETE tags - should return 400 when version out of range`() = testApplication {
        configureTestApp()
        val id = "00000000-0000-0000-0000-000000000040"

        val response = client.delete("/api/v1/tags/$id?version=-1") { withTestAuth() }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        verify(exactly = 0) { tagService.delete(any(), any()) }
    }
}
