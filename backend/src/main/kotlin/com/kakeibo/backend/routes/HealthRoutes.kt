package com.kakeibo.backend.routes

import com.kakeibo.backend.scheduler.RecurringTransactionScheduler
import com.kakeibo.shared.constants.AppConstants
import com.kakeibo.shared.model.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory
import java.time.OffsetDateTime

private val healthLogger = LoggerFactory.getLogger("HealthRoutes")

fun Route.healthRoutes(scheduler: RecurringTransactionScheduler? = null) {

    // Liveness probe
    get("/health/live") {
        call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
    }

    // Readiness probe
    get("/health/ready") {
        val dbStatus = checkDatabase()
        val schedulerStatus = scheduler?.let { checkScheduler(it) }
        val memoryStatus = checkMemory()

        val overallStatus = when {
            dbStatus == "error" -> "error"
            schedulerStatus?.status == "warning" -> "degraded"
            memoryStatus.status == "warning" -> "degraded"
            else -> "ok"
        }

        val statusCode = if (overallStatus == "error") {
            HttpStatusCode.ServiceUnavailable
        } else {
            HttpStatusCode.OK
        }

        call.respond(statusCode, HealthResponse(
            status = overallStatus,
            version = AppConstants.APP_VERSION,
            timestamp = OffsetDateTime.now().toString(),
            checks = HealthChecks(
                database = dbStatus,
                scheduler = schedulerStatus,
                memory = memoryStatus
            )
        ))
    }

    // Legacy /health endpoint (backward compatibility)
    get("/health") {
        val dbStatus = checkDatabase()
        val statusCode = if (dbStatus == "ok") HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable

        call.respond(statusCode, HealthResponse(
            status = if (dbStatus == "ok") "ok" else "error",
            version = AppConstants.APP_VERSION,
            timestamp = OffsetDateTime.now().toString(),
            checks = HealthChecks(database = dbStatus)
        ))
    }
}

private fun checkDatabase(): String {
    return try {
        org.jetbrains.exposed.sql.transactions.transaction {
            exec("SELECT 1") {}
        }
        "ok"
    } catch (e: Exception) {
        healthLogger.error("ヘルスチェック: データベース接続に失敗", e)
        "error"
    }
}

private fun checkScheduler(scheduler: RecurringTransactionScheduler): SchedulerStatus {
    val running = scheduler.isRunning()
    val executing = scheduler.isExecuting()

    return SchedulerStatus(
        status = if (running) "ok" else "warning",
        running = running,
        executing = executing
    )
}

private fun checkMemory(): MemoryStatus {
    val runtime = Runtime.getRuntime()
    val usedMemory = runtime.totalMemory() - runtime.freeMemory()
    val maxMemory = runtime.maxMemory()
    val usedMb = usedMemory / (1024 * 1024)
    val maxMb = maxMemory / (1024 * 1024)
    val usagePercent = ((usedMemory.toDouble() / maxMemory) * 100).toInt()

    val status = when {
        usagePercent > 95 -> "error"
        usagePercent > 90 -> "warning"
        else -> "ok"
    }

    return MemoryStatus(
        status = status,
        usedMb = usedMb,
        maxMb = maxMb,
        usagePercent = usagePercent
    )
}
