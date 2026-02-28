package com.kakeibo.backend.routes

import com.kakeibo.backend.service.NotificationSettingService
import com.kakeibo.shared.model.NotificationSettingRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.notificationSettingRoutes(notificationSettingService: NotificationSettingService) {
    route("/notification-settings") {
        get {
            val settings = notificationSettingService.getAll()
            call.respond(HttpStatusCode.OK, settings)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val request = call.receive<NotificationSettingRequest>()
            val response = notificationSettingService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
