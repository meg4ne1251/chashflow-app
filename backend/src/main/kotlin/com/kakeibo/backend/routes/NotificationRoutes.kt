package com.kakeibo.backend.routes

import com.kakeibo.backend.service.NotificationService
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.notificationRoutes(notificationService: NotificationService) {
    route("/notifications") {
        get {
            val response = notificationService.getUnread()
            call.respond(HttpStatusCode.OK, response)
        }

        get("/recent") {
            val response = notificationService.getRecent()
            call.respond(HttpStatusCode.OK, response)
        }

        put("/{id}/read") {
            val id = call.parameters["id"]!!
            notificationService.markAsRead(id)
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        put("/read-all") {
            notificationService.markAllAsRead()
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }
    }
}
