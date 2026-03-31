package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.getUserId
import com.kakeibo.backend.middleware.UnauthorizedException
import com.kakeibo.backend.service.AccountService
import com.kakeibo.backend.service.AuthService
import com.kakeibo.shared.constants.AppConstants
import com.kakeibo.shared.model.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("AuthRoutes")

// Cookie設定用のヘルパー関数
private fun ApplicationCall.setAuthCookies(accessToken: String, refreshToken: String, expiresIn: Int) {
    // 本番環境かどうかを判定（環境変数またはプロファイルで制御）
    val isProduction = System.getenv("KTOR_ENV") == "production"
    
    response.cookies.append(
        Cookie(
            name = "access_token",
            value = accessToken,
            httpOnly = true,
            secure = isProduction,  // 本番ではtrue、開発ではfalse
            extensions = mapOf("SameSite" to if (isProduction) "Strict" else "Lax"),
            maxAge = expiresIn,
            path = "/api"
        )
    )
    response.cookies.append(
        Cookie(
            name = "refresh_token",
            value = refreshToken,
            httpOnly = true,
            secure = isProduction,
            extensions = mapOf("SameSite" to if (isProduction) "Strict" else "Lax"),
            maxAge = (AppConstants.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60).toInt(),
            path = "/api/v1/auth"
        )
    )
}

// Cookie削除用のヘルパー関数
private fun ApplicationCall.clearAuthCookies() {
    response.cookies.append(
        Cookie(name = "access_token", value = "", maxAge = 0, path = "/api")
    )
    response.cookies.append(
        Cookie(name = "refresh_token", value = "", maxAge = 0, path = "/api/v1/auth")
    )
}

fun Route.authRoutes(authService: AuthService, accountService: AccountService) {
    route("/auth") {
        get("/setup/status") {
            val needsSetup = authService.isSetupRequired()
            call.respond(HttpStatusCode.OK, SetupStatusResponse(needs_setup = needsSetup))
        }

        rateLimit(RateLimitName("auth-setup")) {
            post("/setup") {
                val request = call.receive<SetupRequest>()
                val response = authService.setup(request)

                // Create default accounts
                val defaultAccounts = listOf(
                    AccountRequest(name = "現金", type = "cash", initial_balance = 0, currency = "JPY", sort_order = 1),
                    AccountRequest(name = "銀行口座", type = "bank", initial_balance = 0, currency = "JPY", sort_order = 2),
                    AccountRequest(name = "クレジットカード", type = "credit_card", initial_balance = 0, currency = "JPY", sort_order = 3),
                )
                for (account in defaultAccounts) {
                    try {
                        accountService.create(account)
                    } catch (e: Exception) {
                        logger.warn("Failed to create default account '${account.name}': ${e.message}")
                    }
                }

                call.respond(HttpStatusCode.Created, response)
            }
        }

        rateLimit(RateLimitName("auth-login")) {
            post("/login") {
                val request = call.receive<LoginRequest>()
                val response = authService.login(request)
                
                // Cookieにトークンを設定
                call.setAuthCookies(
                    accessToken = response.access_token,
                    refreshToken = response.refresh_token,
                    expiresIn = response.expires_in
                )
                
                // レスポンスボディにはトークンを含めない
                call.respond(HttpStatusCode.OK, LoginSuccessResponse(username = request.username))
            }
        }

        rateLimit(RateLimitName("auth-refresh")) {
            post("/refresh") {
                // Cookieからリフレッシュトークンを取得
                val refreshToken = call.request.cookies["refresh_token"]
                    ?: throw UnauthorizedException(
                        "リフレッシュトークンがありません", "TOKEN_MISSING"
                    )
                
                val response = authService.refresh(RefreshRequest(refresh_token = refreshToken))
                
                // 新しいトークンをCookieに設定
                call.setAuthCookies(
                    accessToken = response.access_token,
                    refreshToken = response.refresh_token,
                    expiresIn = response.expires_in
                )
                
                call.respond(HttpStatusCode.OK, mapOf("message" to "Token refreshed"))
            }
        }

        authenticate("auth-jwt") {
            // 認証状態確認用エンドポイント
            get("/me") {
                val principal = call.principal<JWTPrincipal>()
                val username = principal?.payload?.getClaim("username")?.asString()
                call.respond(HttpStatusCode.OK, mapOf("username" to username))
            }
            
            post("/logout") {
                // Cookieからリフレッシュトークンを取得して無効化
                val refreshToken = call.request.cookies["refresh_token"]
                if (refreshToken != null) {
                    authService.logout(LogoutRequest(refresh_token = refreshToken))
                }
                
                // Cookieを削除
                call.clearAuthCookies()
                
                call.respond(HttpStatusCode.NoContent)
            }

            put("/password") {
                val userId = call.getUserId()
                val request = call.receive<PasswordChangeRequest>()
                authService.changePassword(userId, request)
                
                // パスワード変更後はCookieを削除（再ログインを強制）
                call.clearAuthCookies()
                
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
}
