package com.kakeibo.backend

import com.kakeibo.backend.config.DatabaseConfig
import com.kakeibo.backend.config.JwtConfig
import com.kakeibo.backend.middleware.configureErrorHandling
import com.kakeibo.backend.middleware.configureRateLimiting
import com.kakeibo.backend.routes.*
import com.kakeibo.backend.scheduler.NotificationScheduler
import com.kakeibo.backend.scheduler.RecurringTransactionScheduler
import com.kakeibo.backend.service.*
import com.kakeibo.backend.repository.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.http.auth.HttpAuthHeader
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.auth.parseAuthorizationHeader
import io.ktor.server.netty.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import org.slf4j.event.Level

fun main(args: Array<String>): Unit = EngineMain.main(args)

fun Application.module() {
    // Database
    DatabaseConfig.init(environment)

    // JWT
    val jwtConfig = JwtConfig(environment)

    // Repositories
    val userRepository = UserRepository()
    val refreshTokenRepository = RefreshTokenRepository()
    val accountRepository = AccountRepository()
    val categoryRepository = CategoryRepository()
    val tagRepository = TagRepository()
    val transactionRepository = TransactionRepository()
    val transactionTagRepository = TransactionTagRepository()
    val transactionHistoryRepository = TransactionHistoryRepository()
    val transferRepository = TransferRepository()
    val templateRepository = TemplateRepository()
    val templateTagRepository = TemplateTagRepository()
    val recurringTransactionRepository = RecurringTransactionRepository()
    val recurringTransactionTagRepository = RecurringTransactionTagRepository()
    val budgetRepository = BudgetRepository()
    val savingsGoalRepository = SavingsGoalRepository()
    val notificationSettingRepository = NotificationSettingRepository()
    val inputPatternRepository = InputPatternRepository()

    // Services
    val authService = AuthService(userRepository, refreshTokenRepository, jwtConfig)
    val accountService = AccountService(accountRepository, transactionRepository, transferRepository)
    val categoryService = CategoryService(categoryRepository, transactionRepository)
    val tagService = TagService(tagRepository, transactionTagRepository, templateTagRepository, recurringTransactionTagRepository)
    val transferService = TransferService(transferRepository)
    val templateService = TemplateService(templateRepository, templateTagRepository, tagRepository)
    val budgetService = BudgetService(budgetRepository, transactionRepository, categoryRepository)
    val notificationRepository = NotificationRepository()
    val savingsGoalService = SavingsGoalService(
        savingsGoalRepository, accountRepository, transferRepository,
        notificationRepository, notificationSettingRepository
    )
    val analyticsService = AnalyticsService(transactionRepository, budgetRepository, categoryRepository, accountService, savingsGoalService)
    val transactionService = TransactionService(
        transactionRepository, transactionTagRepository, transactionHistoryRepository,
        inputPatternRepository, categoryRepository, accountRepository, budgetRepository,
        tagRepository, analyticsService
    )
    val recurringTransactionService = RecurringTransactionService(
        recurringTransactionRepository, recurringTransactionTagRepository,
        transactionRepository, transactionTagRepository, tagRepository
    )
    val syncService = SyncService(
        transactionRepository, categoryRepository, accountRepository,
        tagRepository, templateRepository, recurringTransactionRepository,
        budgetRepository, transferRepository, notificationSettingRepository,
        inputPatternRepository
    )
    val importExportService = ImportExportService(
        transactionRepository, transactionTagRepository, categoryRepository,
        accountRepository, tagRepository, templateRepository, templateTagRepository,
        recurringTransactionRepository, recurringTransactionTagRepository,
        budgetRepository, transferRepository, notificationSettingRepository,
        inputPatternRepository, transactionHistoryRepository
    )
    val suggestionService = SuggestionService(transactionRepository, inputPatternRepository)
    val notificationSettingService = NotificationSettingService(notificationSettingRepository)
    val notificationService = NotificationService(
        notificationRepository, notificationSettingRepository,
        budgetRepository, transactionRepository, categoryRepository,
        accountRepository
    )

    // Plugins
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = false
            isLenient = false
            ignoreUnknownKeys = true
            encodeDefaults = true
        })
    }

    install(CallLogging) {
        level = Level.INFO
        filter { call -> call.request.path().startsWith("/api") }
    }

    val allowedOrigins = environment.config.property("cors.allowedOrigins").getString()
    install(CORS) {
        val configuredOrigins = allowedOrigins.split(",").map { it.trim() }
        configuredOrigins.forEach { origin ->
            allowHost(origin.removePrefix("http://").removePrefix("https://"),
                schemes = listOf("http", "https"))
        }

        // Allow any port on localhost/127.0.0.1 when configured origins include localhost
        // This supports reverse-proxy and port-forwarding scenarios (e.g. Docker, VS Code)
        val localhostConfigured = configuredOrigins.any { origin ->
            val host = origin.removePrefix("http://").removePrefix("https://").substringBefore(":")
            host == "localhost" || host == "127.0.0.1"
        }
        if (localhostConfigured) {
            allowOrigins { origin ->
                val host = origin.removePrefix("http://").removePrefix("https://").substringBefore(":")
                host == "localhost" || host == "127.0.0.1"
            }
        }

        // Cookie送受信を許可
        allowCredentials = true

        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Options)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.Accept)
    }

    install(Authentication) {
        jwt("auth-jwt") {
            realm = jwtConfig.realm
            verifier(
                com.auth0.jwt.JWT.require(jwtConfig.getAlgorithm())
                    .withIssuer(jwtConfig.issuer)
                    .withAudience(jwtConfig.audience)
                    .build()
            )
            
            // CookieまたはAuthorizationヘッダーからトークンを取得
            authHeader { call ->
                // 1. まずCookieから取得を試みる
                val cookieToken = call.request.cookies["access_token"]
                if (cookieToken != null) {
                    return@authHeader HttpAuthHeader.Single("Bearer", cookieToken)
                }
                // 2. Cookieになければ従来のAuthorizationヘッダーから取得
                call.request.parseAuthorizationHeader()
            }
            
            validate { credential ->
                val userId = credential.payload.getClaim("user_id")?.asString()
                if (userId != null) {
                    JWTPrincipal(credential.payload)
                } else null
            }
            challenge { _, _ ->
                call.respond(
                    io.ktor.http.HttpStatusCode.Unauthorized,
                    com.kakeibo.shared.model.ErrorResponse(
                        error = com.kakeibo.shared.model.ErrorBody(
                            code = com.kakeibo.shared.constants.ErrorCodes.UNAUTHORIZED,
                            message = "認証が必要です"
                        )
                    )
                )
            }
        }
    }

    configureRateLimiting()
    configureErrorHandling()

    // Routes
    routing {
        route("/api/v1") {
            authRoutes(authService, accountService)
            healthRoutes()

            authenticate("auth-jwt") {
                accountRoutes(accountService)
                categoryRoutes(categoryService)
                tagRoutes(tagService)
                transactionRoutes(transactionService)
                transferRoutes(transferService)
                templateRoutes(templateService)
                recurringTransactionRoutes(recurringTransactionService)
                budgetRoutes(budgetService)
                savingsGoalRoutes(savingsGoalService)
                analyticsRoutes(analyticsService)
                syncRoutes(syncService)
                importExportRoutes(importExportService)
                suggestionRoutes(suggestionService)
                notificationRoutes(notificationService)
                notificationSettingRoutes(notificationSettingService)
            }
        }
    }

    // Start recurring transaction scheduler with daily maintenance tasks
    val scheduler = RecurringTransactionScheduler(
        recurringTransactionService,
        dailyCleanupTasks = listOf(
            { refreshTokenRepository.cleanupExpired() },
            { notificationService.cleanupOldNotifications() }
        )
    )
    scheduler.start()

    // Start notification scheduler (checks every 60 seconds)
    val notificationScheduler = NotificationScheduler(notificationService)
    notificationScheduler.start()

    monitor.subscribe(ApplicationStopped) {
        scheduler.stop()
        notificationScheduler.stop()
        DatabaseConfig.close()
    }
}
