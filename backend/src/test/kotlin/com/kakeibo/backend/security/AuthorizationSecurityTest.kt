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
 * 本アプリは「1 デプロイ ＝ 1 ユーザー」のシングルテナント設計（README.md / SECURITY.md 参照）。
 * 他ユーザーのデータが存在し得ないため IDOR は構造上発生しない。
 * ここでは「認証済みユーザーが自身のデータにアクセスできること」のみを検証する。
 */
class AuthorizationSecurityTest {
    private lateinit var userAId: UUID
    private lateinit var userATransactionId: UUID
    private lateinit var categoryId: UUID
    private lateinit var accountId: UUID

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        TestHelper.cleanDatabase()

        transaction {
            val userRepo = UserRepository()
            userAId = userRepo.create("userA", "hash").id

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
