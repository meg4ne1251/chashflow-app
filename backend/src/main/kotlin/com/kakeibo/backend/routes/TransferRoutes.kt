package com.kakeibo.backend.routes

import com.kakeibo.backend.service.TransferService
import com.kakeibo.shared.model.TransferRequest
import com.kakeibo.shared.validation.ValidationRules
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.transferRoutes(transferService: TransferService) {
    route("/transfers") {
        get {
            val dateFrom = call.request.queryParameters["date_from"]
            val dateTo = call.request.queryParameters["date_to"]
            val accountId = call.request.queryParameters["account_id"]
            val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
            val size = (call.request.queryParameters["size"]?.toIntOrNull()
                ?: ValidationRules.DEFAULT_PAGE_SIZE).coerceIn(1, ValidationRules.MAX_PAGE_SIZE)

            val response = transferService.getAll(dateFrom, dateTo, accountId, page, size)
            call.respond(HttpStatusCode.OK, response)
        }

        get("/{id}") {
            val id = call.parameters["id"]!!
            val response = transferService.getById(id)
            call.respond(HttpStatusCode.OK, response)
        }

        post {
            val request = call.receive<TransferRequest>()
            val response = transferService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val request = call.receive<TransferRequest>()
            val response = transferService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        patch("/{id}/restore") {
            val id = call.parameters["id"]!!
            transferService.restore(id)
            call.respond(HttpStatusCode.OK, mapOf("status" to "restored"))
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            transferService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
