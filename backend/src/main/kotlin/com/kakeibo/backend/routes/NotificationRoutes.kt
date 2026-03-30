package com.kakeibo.backend.routes

import com.kakeibo.backend.service.NotificationService
import com.kakeibo.shared.validation.ValidationRules
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.notificationRoutes(notificationService: NotificationService) {
    route("/notifications") {
        get {
            val response = notificationService.getUnread()
            call.respond(HttpStatusCode.OK, response)
        }

        get("/history") {
            val type = call.request.queryParameters["type"]
            val isRead = call.request.queryParameters["is_read"]?.toBooleanStrictOrNull()
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val size = (call.request.queryParameters["size"]?.toIntOrNull()
                ?: ValidationRules.DEFAULT_PAGE_SIZE).coerceIn(1, ValidationRules.MAX_PAGE_SIZE)
            val response = notificationService.getHistory(type, isRead, page, size)
            call.respond(HttpStatusCode.OK, response)
        }

        get("/recent") {
            val response = notificationService.getRecent()
            call.respond(HttpStatusCode.OK, response)
        }

        put("/{id}/read") {
            val id = validateUuidParam(call.parameters["id"])
            notificationService.markAsRead(id)
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        put("/read-all") {
            notificationService.markAllAsRead()
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }
    }
}
