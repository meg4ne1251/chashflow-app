package com.kakeibo.backend.middleware

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory

private val csrfLogger = LoggerFactory.getLogger("CsrfProtection")

/**
 * CSRF保護設定クラス
 */
class CsrfProtectionConfig {
    var allowedOrigins: Set<String> = emptySet()
}

/**
 * CSRF保護のためのOrigin検証プラグイン
 * 
 * 状態変更リクエスト（POST/PUT/PATCH/DELETE）に対して
 * OriginまたはRefererヘッダーを検証する
 */
val CsrfProtection = createRouteScopedPlugin(
    name = "CsrfProtection",
    createConfiguration = ::CsrfProtectionConfig
) {
    val allowedOrigins = pluginConfig.allowedOrigins

    onCall { call ->
        val method = call.request.httpMethod
        
        // GET, HEAD, OPTIONSは検証不要
        if (method in listOf(HttpMethod.Get, HttpMethod.Head, HttpMethod.Options)) {
            return@onCall
        }
        
        // 認証エンドポイントは除外（ログイン前なのでOriginが異なる場合がある）
        val path = call.request.path()
        if (path.startsWith("/api/v1/auth/login") || 
            path.startsWith("/api/v1/auth/setup") ||
            path.startsWith("/api/v1/health")) {
            return@onCall
        }
        
        // Origin または Referer ヘッダーを取得
        val origin = call.request.header(HttpHeaders.Origin)
        val referer = call.request.header(HttpHeaders.Referrer)
        
        val requestOrigin = origin ?: referer?.let {
            try {
                val url = java.net.URI(it)
                "${url.scheme}://${url.host}" + (if (url.port != -1) ":${url.port}" else "")
            } catch (_: Exception) {
                null
            }
        }
        
        if (requestOrigin == null) {
            csrfLogger.warn("CSRF: No Origin/Referer header for ${method.value} $path")
            call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Origin header required"))
            return@onCall
        }
        
        // 許可されたOriginかチェック
        val isAllowed = allowedOrigins.any { allowed ->
            requestOrigin == allowed || 
            // localhost対応（ポート違いを許容）
            (allowed.contains("localhost") && requestOrigin.contains("localhost")) ||
            (allowed.contains("127.0.0.1") && requestOrigin.contains("127.0.0.1"))
        }
        
        if (!isAllowed) {
            csrfLogger.warn("CSRF: Invalid origin '$requestOrigin' for ${method.value} $path. Allowed: $allowedOrigins")
            call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Invalid origin"))
            return@onCall
        }
    }
}
