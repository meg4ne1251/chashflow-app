package com.kakeibo.backend.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("CspReportRoutes")

fun Route.cspReportRoutes() {
    post("/csp-report") {
        val report = call.receiveText()
        logger.warn("CSP Violation Report: $report")
        call.respond(HttpStatusCode.NoContent)
    }
}
