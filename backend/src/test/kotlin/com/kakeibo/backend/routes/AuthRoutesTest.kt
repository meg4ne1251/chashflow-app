package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.service.AccountService
import com.kakeibo.backend.service.AuthService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.*
import kotlinx.serialization.json.Json
import kotlin.test.*
import kotlin.time.Duration.Companion.minutes

class AuthRoutesTest {

    private val authService = mockk<AuthService>()
    private val accountService = mockk<AccountService>(relaxed = true)

    private fun ApplicationTestBuilder.configureTestApp() {
        application {
            install(ContentNegotiation) {
                json(Json {
                    prettyPrint = false
                    isLenient = false
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                })
            }
            install(RateLimit) {
                register(RateLimitName("auth-login")) {
                    rateLimiter(limit = 5, refillPeriod = 1.minutes)
                }
                register(RateLimitName("auth-setup")) {
                    rateLimiter(limit = 3, refillPeriod = 1.minutes)
                }
            }
            install(StatusPages) {
                exception<AppException> { call, cause ->
                    call.respond(
                        cause.statusCode,
                        ErrorResponse(
                            error = ErrorBody(
                                code = cause.errorCode,
                                message = cause.message ?: "Unknown error",
                                details = cause.details
                            )
                        )
                    )
                }
            }
            install(Authentication) {
                jwt("auth-jwt") {
                    realm = "test"
                    verifier(
                        com.auth0.jwt.JWT.require(com.auth0.jwt.algorithms.Algorithm.HMAC256("test-secret"))
                            .withIssuer("test-issuer")
                            .build()
                    )
                    validate { JWTPrincipal(it.payload) }
                }
            }
            routing {
                route("/api/v1") {
                    authRoutes(authService, accountService)
                }
            }
        }
    }

    @BeforeTest
    fun setUp() {
        clearMocks(authService, accountService)
    }

    // ===========================
    // POST /setup
    // ===========================

    @Test
    fun `POST setup - returns 201 on success`() = testApplication {
        configureTestApp()
        every { authService.setup(any()) } returns SetupResponse(
            user = UserResponse("user-id-1", "testuser")
        )

        val response = client.post("/api/v1/auth/setup") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"testuser","password":"Password1"}""")
        }

        assertEquals(HttpStatusCode.Created, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("testuser"))
    }

    @Test
    fun `POST setup - returns 409 when already set up`() = testApplication {
        configureTestApp()
        every { authService.setup(any()) } throws ConflictException("初期セットアップは既に完了しています")

        val response = client.post("/api/v1/auth/setup") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"testuser","password":"Password1"}""")
        }

        assertEquals(HttpStatusCode.Conflict, response.status)
    }

    // ===========================
    // POST /login
    // ===========================

    @Test
    fun `POST login - returns 200 on success`() = testApplication {
        configureTestApp()
        every { authService.login(any()) } returns LoginResponse(
            access_token = "access-token",
            refresh_token = "refresh-token",
            expires_in = 900
        )

        val response = client.post("/api/v1/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"testuser","password":"Password1"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.contains("access-token"))
    }

    @Test
    fun `POST login - returns 401 with wrong credentials`() = testApplication {
        configureTestApp()
        every { authService.login(any()) } throws UnauthorizedException("ユーザー名またはパスワードが正しくありません")

        val response = client.post("/api/v1/auth/login") {
            contentType(ContentType.Application.Json)
            setBody("""{"username":"wrong","password":"Wrong1pass"}""")
        }

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    // ===========================
    // POST /refresh
    // ===========================

    @Test
    fun `POST refresh - returns 200 on success`() = testApplication {
        configureTestApp()
        every { authService.refresh(any()) } returns LoginResponse(
            access_token = "new-access-token",
            refresh_token = "new-refresh-token",
            expires_in = 900
        )

        val response = client.post("/api/v1/auth/refresh") {
            contentType(ContentType.Application.Json)
            setBody("""{"refresh_token":"valid-token"}""")
        }

        assertEquals(HttpStatusCode.OK, response.status)
    }

    // ===========================
    // POST /logout
    // ===========================

    @Test
    fun `POST logout - returns 401 without auth`() = testApplication {
        configureTestApp()
        every { authService.logout(any()) } just runs

        val response = client.post("/api/v1/auth/logout") {
            contentType(ContentType.Application.Json)
            setBody("""{"refresh_token":"some-token"}""")
        }

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }
}
