package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.AppException
import com.kakeibo.shared.model.ErrorBody
import com.kakeibo.shared.model.ErrorResponse
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import java.util.*

/**
 * Routes テスト用のヘルパーオブジェクト
 * JWT認証をテスト環境で簡単に設定するためのユーティリティを提供
 */
object RouteTestHelper {
    val testUserId: UUID = UUID.fromString("00000000-0000-0000-0000-000000000001")
    const val testSecret = "test-secret-key-for-testing-purposes-only"
    const val testIssuer = "test-issuer"

    /**
     * テストアプリケーションを設定する
     * ContentNegotiation, StatusPages, Authentication を設定
     */
    fun ApplicationTestBuilder.configureTestApp(
        configureRoutes: Application.() -> Unit
    ) {
        application {
            install(ContentNegotiation) {
                json(Json {
                    prettyPrint = false
                    isLenient = false
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                })
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
                        com.auth0.jwt.JWT.require(
                            com.auth0.jwt.algorithms.Algorithm.HMAC256(testSecret)
                        ).withIssuer(testIssuer).build()
                    )
                    validate { credential ->
                        JWTPrincipal(credential.payload)
                    }
                }
            }
            configureRoutes()
        }
    }

    /**
     * テスト用のJWTトークンを生成する
     */
    fun generateTestToken(
        userId: UUID = testUserId,
        username: String = "testuser",
        expiresAt: java.util.Date? = null
    ): String {
        val builder = com.auth0.jwt.JWT.create()
            .withIssuer(testIssuer)
            // 本番トークン (JwtConfig.generateAccessToken) は snake_case の user_id を使う。
            // getUserId() はこの user_id クレームを読むため、両方を付与しておく。
            .withClaim("user_id", userId.toString())
            .withClaim("userId", userId.toString())
            .withClaim("username", username)
        
        if (expiresAt != null) {
            builder.withExpiresAt(expiresAt)
        }
        
        return builder.sign(com.auth0.jwt.algorithms.Algorithm.HMAC256(testSecret))
    }

    /**
     * テスト用の期限切れトークンを生成する
     */
    fun generateExpiredToken(userId: UUID = testUserId): String {
        return com.auth0.jwt.JWT.create()
            .withIssuer(testIssuer)
            .withClaim("userId", userId.toString())
            .withExpiresAt(java.util.Date(System.currentTimeMillis() - 3600000))
            .sign(com.auth0.jwt.algorithms.Algorithm.HMAC256(testSecret))
    }

    /**
     * 不正な署名のトークンを生成する
     */
    fun generateWrongKeyToken(userId: UUID = testUserId): String {
        return com.auth0.jwt.JWT.create()
            .withIssuer(testIssuer)
            .withClaim("userId", userId.toString())
            .sign(com.auth0.jwt.algorithms.Algorithm.HMAC256("wrong-secret-key"))
    }

    /**
     * HttpRequestBuilder に認証ヘッダーを追加する
     */
    fun HttpRequestBuilder.withTestAuth(userId: UUID = testUserId) {
        header(HttpHeaders.Authorization, "Bearer ${generateTestToken(userId)}")
    }
}
