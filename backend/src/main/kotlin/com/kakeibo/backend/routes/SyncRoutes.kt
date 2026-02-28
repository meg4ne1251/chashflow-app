package com.kakeibo.backend.routes

import com.kakeibo.backend.service.SyncService
import com.kakeibo.shared.model.SyncPushRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.syncRoutes(syncService: SyncService) {
    route("/sync") {
        post("/push") {
            val request = call.receive<SyncPushRequest>()
            val response = syncService.push(request)
            call.respond(HttpStatusCode.OK, response)
        }

        get("/pull") {
            val since = call.request.queryParameters["since"]
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "since パラメータを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("since", "ISO 8601形式のタイムスタンプは必須です"))
                )
            val response = syncService.pull(since)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
