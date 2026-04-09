package com.kakeibo.backend.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("CspReportRoutes")

// CSP レポートの最大サイズ。通常のレポートは数 KB 程度なので 16KB で十分。
// 無制限にするとログ氾濫攻撃のベクタになるため明示的に上限を設ける。
private const val MAX_CSP_REPORT_SIZE = 16 * 1024

fun Route.cspReportRoutes() {
    post("/csp-report") {
        // Content-Length を事前チェックして過大なペイロードを受け取らない
        val contentLength = call.request.header(HttpHeaders.ContentLength)?.toLongOrNull()
        if (contentLength != null && contentLength > MAX_CSP_REPORT_SIZE) {
            call.respond(HttpStatusCode.PayloadTooLarge)
            return@post
        }

        val report = call.receiveText()
        if (report.length > MAX_CSP_REPORT_SIZE) {
            call.respond(HttpStatusCode.PayloadTooLarge)
            return@post
        }

        // ログも切り詰めて保存（ログストレージ保護）
        val truncated = if (report.length > 2000) report.take(2000) + "...(truncated)" else report
        logger.warn("CSP Violation Report: {}", truncated)
        call.respond(HttpStatusCode.NoContent)
    }
}
