package com.kakeibo.backend.security

import com.kakeibo.backend.routes.RouteTestHelper
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.routes.transactionRoutes
import com.kakeibo.backend.service.TransactionService
import com.kakeibo.shared.model.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import io.mockk.every
import io.mockk.mockk
import kotlin.test.*

class AuthenticationSecurityTest {
    private lateinit var transactionService: TransactionService

    @BeforeTest
    fun setUp() {
        transactionService = mockk(relaxed = true)
        // getAll()がnullではなく空のPaginatedResponseを返すようにモック
        every { transactionService.getAll(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()) } returns
            PaginatedResponse(
                data = emptyList(),
                pagination = PaginationInfo(page = 1, size = 50, total_count = 0, total_pages = 0)
            )
    }

    @Test
    fun `request without token should return 401`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.get("/api/v1/transactions")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `request with invalid token should return 401`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.get("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "Bearer invalid.token.here")
        }
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `request with expired token should return 401`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val expiredToken = RouteTestHelper.generateExpiredToken()

        val response = client.get("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "Bearer $expiredToken")
        }
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `request with token signed by wrong key should return 401`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val wrongKeyToken = RouteTestHelper.generateWrongKeyToken()

        val response = client.get("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "Bearer $wrongKeyToken")
        }
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `request with valid token should succeed`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.get("/api/v1/transactions") {
            withTestAuth()
        }
        assertEquals(HttpStatusCode.OK, response.status)
    }

    @Test
    fun `request with malformed Authorization header should return 401`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.get("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "NotBearer some-token")
        }
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `request with empty bearer token should return 401`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.get("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "Bearer ")
        }
        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }
}
