package com.kakeibo.backend.routes

import com.kakeibo.shared.constants.AppConstants
import com.kakeibo.shared.model.HealthChecks
import com.kakeibo.shared.model.HealthResponse
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory
import java.time.OffsetDateTime

private val healthLogger = LoggerFactory.getLogger("HealthRoutes")

fun Route.healthRoutes() {
    get("/health") {
        val dbStatus = try {
            org.jetbrains.exposed.sql.transactions.transaction {
                exec("SELECT 1") {}
            }
            "ok"
        } catch (e: Exception) {
            healthLogger.error("ヘルスチェック: データベース接続に失敗", e)
            "error"
        }

        val status = if (dbStatus == "ok") "ok" else "error"
        val statusCode = if (status == "ok") HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable

        call.respond(statusCode, HealthResponse(
            status = status,
            version = AppConstants.APP_VERSION,
            timestamp = OffsetDateTime.now().toString(),
            checks = HealthChecks(database = dbStatus)
        ))
    }
}
