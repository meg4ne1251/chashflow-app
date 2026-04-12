package com.kakeibo.backend.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import org.slf4j.LoggerFactory

private val metricsLogger = LoggerFactory.getLogger("MetricsRoutes")

/**
 * Prometheusスクレイピング用エンドポイント。
 *
 * セキュリティ方針:
 *   1. デフォルトではループバック (127.0.0.1 / ::1) からのアクセスのみ許可する。
 *   2. 環境変数 METRICS_TOKEN が設定されている場合、
 *      Authorization: Bearer <token> による認証でループバック以外からもアクセス可能。
 *   3. いずれの条件も満たさない場合は 403 Forbidden を返す。
 *
 * この制御はアプリ層で実装しているが、本番環境では
 * 追加でリバースプロキシ側の IP 制限・TLS mTLS などを併用することを推奨する。
 */
fun Route.metricsRoutes(registry: PrometheusMeterRegistry) {
    val expectedToken = System.getenv("METRICS_TOKEN")?.takeIf { it.isNotBlank() }

    get("/metrics") {
        if (!isMetricsAccessAllowed(call, expectedToken)) {
            metricsLogger.warn(
                "Metrics access denied from {}",
                call.request.origin.remoteHost
            )
            call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Forbidden"))
            return@get
        }
        call.respondText(
            registry.scrape(),
            contentType = ContentType.Text.Plain
        )
    }
}

private fun isMetricsAccessAllowed(call: ApplicationCall, expectedToken: String?): Boolean {
    // 1. ループバック接続は常に許可
    val remoteHost = call.request.origin.remoteHost
    if (isLoopbackHost(remoteHost)) return true

    // 2. トークンが設定されていれば Bearer 認証を許可
    if (expectedToken != null) {
        val authHeader = call.request.header(HttpHeaders.Authorization) ?: return false
        val token = authHeader.removePrefix("Bearer ").trim()
        // タイミング攻撃対策: 定数時間比較
        return constantTimeEquals(token, expectedToken)
    }

    return false
}

private fun isLoopbackHost(host: String): Boolean {
    return host == "127.0.0.1" ||
        host == "::1" ||
        host == "0:0:0:0:0:0:0:1" ||
        host == "localhost"
}

private fun constantTimeEquals(a: String, b: String): Boolean {
    return java.security.MessageDigest.isEqual(a.toByteArray(), b.toByteArray())
}
