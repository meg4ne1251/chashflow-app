package com.kakeibo.backend.security

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.*
import com.kakeibo.backend.repository.*
import com.kakeibo.backend.routes.RouteTestHelper
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import com.kakeibo.backend.routes.transactionRoutes
import com.kakeibo.backend.service.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.util.*
import kotlin.test.*

/**
 * 認可セキュリティテスト
 * 
 * 注意: 現在のアプリケーションはシングルユーザー設計のため、
 * マルチテナント向けの認可テストは @Ignore でスキップしています。
 * マルチテナント機能が実装された際に有効化してください。
 */
class AuthorizationSecurityTest {
    private lateinit var userAId: UUID
    private lateinit var userBId: UUID
    private lateinit var userATransactionId: UUID
    private lateinit var categoryId: UUID
    private lateinit var accountId: UUID

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        TestHelper.cleanDatabase()

        // 2人のユーザーを作成
        transaction {
            val userRepo = UserRepository()
            userAId = userRepo.create("userA", "hash").id
            userBId = userRepo.create("userB", "hash").id

            // UserAのデータを作成
            val categoryRepo = CategoryRepository()
            val accountRepo = AccountRepository()
            val txRepo = TransactionRepository()

            // カテゴリ作成
            val categoryRow = categoryRepo.create(
                id = UUID.randomUUID(),
                name = "食費",
                type = "expense",
                icon = "restaurant",
                color = "#FF0000",
                sortOrder = 1
            )
            categoryId = categoryRow[Categories.id]

            // アカウント作成
            val accountRow = accountRepo.create(
                id = UUID.randomUUID(),
                name = "現金",
                type = "cash",
                initialBalance = 10000,
                currency = "JPY",
                sortOrder = 1,
                paymentDay = null
            )
            accountId = accountRow[Accounts.id]

            // UserAのトランザクション作成
            val txRow = txRepo.create(
                id = UUID.randomUUID(),
                type = "expense",
                amount = 1000,
                currency = "JPY",
                date = LocalDateTime.now(),
                memo = "UserAの取引",
                categoryId = categoryId,
                accountId = accountId
            )
            userATransactionId = txRow[Transactions.id]
        }
    }

    // =========================================================================
    // シングルユーザー環境で有効なテスト
    // =========================================================================

    @Test
    fun `authenticated user can access their own transactions`() = testApplication {
        val transactionService = createTransactionService()

        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        // 認証済みユーザーがトランザクション一覧を取得できる
        val response = client.get("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "Bearer ${RouteTestHelper.generateTestToken(userAId)}")
        }
        assertEquals(HttpStatusCode.OK, response.status)
    }

    @Test
    fun `authenticated user can access specific transaction`() = testApplication {
        val transactionService = createTransactionService()

        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        // 認証済みユーザーが特定トランザクションを取得できる
        val response = client.get("/api/v1/transactions/$userATransactionId") {
            header(HttpHeaders.Authorization, "Bearer ${RouteTestHelper.generateTestToken(userAId)}")
        }
        assertEquals(HttpStatusCode.OK, response.status)
    }

    // =========================================================================
    // マルチテナント機能実装後に有効化するテスト
    // 現在のアプリはシングルユーザーのため、これらのテストはスキップ
    // =========================================================================

    @Ignore("マルチテナント機能実装後に有効化")
    @Test
    fun `user should not access other user's transaction`() = testApplication {
        val transactionService = createTransactionService()

        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        // UserBとしてUserAの取引にアクセス（マルチテナント実装後は404を期待）
        val response = client.get("/api/v1/transactions/$userATransactionId") {
            header(HttpHeaders.Authorization, "Bearer ${RouteTestHelper.generateTestToken(userBId)}")
        }

        // マルチテナント実装後は404を期待
        assertEquals(HttpStatusCode.NotFound, response.status)
    }

    @Ignore("マルチテナント機能実装後に有効化")
    @Test
    fun `user should not update other user's transaction`() = testApplication {
        val transactionService = createTransactionService()

        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.put("/api/v1/transactions/$userATransactionId") {
            header(HttpHeaders.Authorization, "Bearer ${RouteTestHelper.generateTestToken(userBId)}")
            contentType(ContentType.Application.Json)
            setBody("""
                {
                    "type": "expense",
                    "amount": 9999,
                    "category_id": "$categoryId",
                    "account_id": "$accountId",
                    "date": "2024-01-01T00:00",
                    "version": 1
                }
            """.trimIndent())
        }

        // 404 Not Found（存在しないように見せる）か 403 Forbidden
        assertTrue(
            response.status in listOf(HttpStatusCode.NotFound, HttpStatusCode.Forbidden),
            "Expected 404 or 403, got ${response.status}"
        )
    }

    @Ignore("マルチテナント機能実装後に有効化")
    @Test
    fun `user should not delete other user's transaction`() = testApplication {
        val transactionService = createTransactionService()

        configureTestApp {
            routing {
                authenticate("auth-jwt") {
                    route("/api/v1") {
                        transactionRoutes(transactionService)
                    }
                }
            }
        }

        val response = client.delete("/api/v1/transactions/$userATransactionId?version=1") {
            header(HttpHeaders.Authorization, "Bearer ${RouteTestHelper.generateTestToken(userBId)}")
        }

        assertTrue(
            response.status in listOf(HttpStatusCode.NotFound, HttpStatusCode.Forbidden),
            "Expected 404 or 403, got ${response.status}"
        )
    }

    @Ignore("マルチテナント機能実装後に有効化")
    @Test
    fun `user should not access other user's accounts`() = testApplication {
        // マルチテナント実装後にAccountRoutesでテスト
        // 現時点ではスキップ
    }

    @Ignore("マルチテナント機能実装後に有効化")
    @Test
    fun `user should not access other user's budgets`() = testApplication {
        // マルチテナント実装後にBudgetRoutesでテスト
        // 現時点ではスキップ
    }

    // =========================================================================
    // ヘルパーメソッド
    // =========================================================================

    private fun createTransactionService(): TransactionService {
        val transactionRepository = TransactionRepository()
        val transactionTagRepository = TransactionTagRepository()
        val transactionHistoryRepository = TransactionHistoryRepository()
        val inputPatternRepository = InputPatternRepository()
        val categoryRepository = CategoryRepository()
        val accountRepository = AccountRepository()
        val budgetRepository = BudgetRepository()
        val tagRepository = TagRepository()

        return TransactionService(
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
}
