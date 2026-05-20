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
/**
 * OriginがlocalhostまたはIPv4ループバックかどうかを厳密に判定する。
 * "localhost-evil.com" のようなサブドメイン攻撃を防止するため、
 * URIパースでホスト名を正確に取得する。
 */
private fun isLocalhostOrigin(origin: String): Boolean {
    return try {
        val host = java.net.URI(origin).host ?: return false
        host == "localhost" || host == "127.0.0.1"
    } catch (_: Exception) {
        false
    }
}

/**
 * リクエストの Origin / Referer が許可された一覧と一致するか検証する。
 * 不一致時は ForbiddenException をスローして処理を中断する。
 */
fun validateOriginOrThrow(
    call: io.ktor.server.application.ApplicationCall,
    allowedOrigins: Set<String>
) {
    val method = call.request.httpMethod
    if (method in listOf(HttpMethod.Get, HttpMethod.Head, HttpMethod.Options)) {
        return
    }

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
        csrfLogger.warn("CSRF: No Origin/Referer header for ${method.value} ${call.request.path()}")
        throw ForbiddenException("Origin header required")
    }

    val isAllowed = allowedOrigins.any { allowed ->
        requestOrigin == allowed ||
            (isLocalhostOrigin(allowed) && isLocalhostOrigin(requestOrigin))
    }

    if (!isAllowed) {
        csrfLogger.warn("CSRF: Invalid origin '$requestOrigin' for ${method.value} ${call.request.path()}. Allowed: $allowedOrigins")
        throw ForbiddenException("Invalid origin")
    }
}

val CsrfProtection = createRouteScopedPlugin(
    name = "CsrfProtection",
    createConfiguration = ::CsrfProtectionConfig
) {
    val allowedOrigins = pluginConfig.allowedOrigins

    onCall { call ->
        // 認証エンドポイントは除外（ログイン前なのでOriginが異なる場合がある）
        val path = call.request.path()
        if (path == "/api/v1/auth/login" ||
            path == "/api/v1/auth/setup" ||
            path == "/api/v1/health") {
            return@onCall
        }

        validateOriginOrThrow(call, allowedOrigins)
    }
}
