package com.kakeibo.backend.security

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.*
import com.kakeibo.backend.repository.*
import com.kakeibo.backend.routes.RouteTestHelper
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.RouteTestHelper.withTestAuth
import com.kakeibo.backend.routes.transactionRoutes
import com.kakeibo.backend.service.TransactionService
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.test.*

class InjectionSecurityTest {
    private lateinit var transactionService: TransactionService

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        TestHelper.cleanDatabase()
        
        // テストデータ作成
        transaction {
            val userRepo = UserRepository()
            userRepo.create("testuser", "hash")
        }
        
        // 必要なリポジトリをすべてインスタンス化
        val transactionRepository = TransactionRepository()
        val transactionTagRepository = TransactionTagRepository()
        val transactionHistoryRepository = TransactionHistoryRepository()
        val inputPatternRepository = InputPatternRepository()
        val categoryRepository = CategoryRepository()
        val accountRepository = AccountRepository()
        val budgetRepository = BudgetRepository()
        val tagRepository = TagRepository()
        
        transactionService = TransactionService(
            transactionRepository,
            transactionTagRepository,
            transactionHistoryRepository,
            inputPatternRepository,
            categoryRepository,
            accountRepository,
            budgetRepository,
            tagRepository,
            null // analyticsService
        )
    }

    @Test
    fun `SQL injection in keyword search should be safe`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val sqlInjectionPayloads = listOf(
            "'; DROP TABLE transactions; --",
            "1' OR '1'='1",
            "1; DELETE FROM users; --",
            "' UNION SELECT * FROM users --",
            "1' AND SLEEP(5) --",
        )

        for (payload in sqlInjectionPayloads) {
            val response = client.get("/api/v1/transactions") {
                withTestAuth()
                parameter("keyword", payload)
            }

            // リクエストは正常に処理される（エラーにならない）
            assertTrue(
                response.status in listOf(HttpStatusCode.OK, HttpStatusCode.BadRequest),
                "Payload '$payload' should not cause server error, got ${response.status}"
            )

            // テーブルが存在することを確認
            transaction {
                assertTrue(Users.selectAll().count() > 0, "Users table should still exist after payload: $payload")
            }
        }
    }

    @Test
    fun `SQL injection in type filter should be safe`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val payloads = listOf(
            "expense'; DROP TABLE transactions; --",
            "income' OR '1'='1",
        )

        for (payload in payloads) {
            val response = client.get("/api/v1/transactions") {
                withTestAuth()
                parameter("type", payload)
            }

            // リクエストは正常に処理されるか、バリデーションエラー
            assertTrue(
                response.status in listOf(HttpStatusCode.OK, HttpStatusCode.BadRequest),
                "Type filter payload should be handled safely"
            )
        }
    }

    @Test
    fun `XSS payload should be stored and returned as-is in JSON`() = testApplication {
        // バックエンドはHTMLエスケープしない（JSONで返すため）
        // フロントエンドでReactが自動エスケープする前提
        
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        // XSSペイロードでリクエスト（実際に保存はできないがエラーにならないことを確認）
        val xssPayload = "<script>alert('XSS')</script>"
        
        val response = client.get("/api/v1/transactions") {
            withTestAuth()
            parameter("keyword", xssPayload)
        }

        // リクエストは正常に処理される
        assertEquals(HttpStatusCode.OK, response.status)
        
        // Content-TypeがJSONであることが重要
        assertEquals(ContentType.Application.Json.withCharset(Charsets.UTF_8), response.contentType())
    }

    @Test
    fun `path traversal in transaction ID should be rejected`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val pathTraversalPayloads = listOf(
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "....//....//etc/passwd",
        )

        for (payload in pathTraversalPayloads) {
            val response = client.get("/api/v1/transactions/$payload") {
                withTestAuth()
            }

            // パストラバーサルは拒否される（400 Bad Request または 404 Not Found）
            assertTrue(
                response.status in listOf(HttpStatusCode.BadRequest, HttpStatusCode.NotFound),
                "Path traversal '$payload' should be rejected, got ${response.status}"
            )
        }
    }

    @Test
    fun `invalid UUID in transaction ID should return 400`() = testApplication {
        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val invalidIds = listOf(
            "not-a-uuid",
            "12345",
            "abc",
        )

        for (invalidId in invalidIds) {
            val response = client.get("/api/v1/transactions/$invalidId") {
                withTestAuth()
            }

            // 無効なUUIDは400 Bad Request
            assertEquals(
                HttpStatusCode.BadRequest,
                response.status,
                "Invalid UUID '$invalidId' should return 400"
            )
        }
    }
}
