package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.getUserId
import com.kakeibo.backend.service.TransactionService
import com.kakeibo.shared.model.TransactionRequest
import com.kakeibo.shared.validation.ValidationRules
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.transactionRoutes(transactionService: TransactionService) {
    route("/transactions") {
        get {
            val dateFrom = call.request.queryParameters["date_from"]
            val dateTo = call.request.queryParameters["date_to"]
            val type = call.request.queryParameters["type"]
            val categoryId = call.request.queryParameters["category_id"]
            val accountId = call.request.queryParameters["account_id"]
            val tagIds = call.request.queryParameters["tag_ids"]
            val keyword = call.request.queryParameters["keyword"]
            val page = call.request.queryParameters["page"]?.toIntOrNull()
            val size = (call.request.queryParameters["size"]?.toIntOrNull()
                ?: ValidationRules.DEFAULT_PAGE_SIZE).coerceIn(1, ValidationRules.MAX_PAGE_SIZE)
            val sort = call.request.queryParameters["sort"]

            val response = transactionService.getAll(
                dateFrom, dateTo, type, categoryId, accountId,
                tagIds, keyword, page ?: 1, size, sort
            )
            call.respond(HttpStatusCode.OK, response)
        }

        get("/{id}") {
            val id = call.parameters["id"]!!
            val response = transactionService.getById(id)
            call.respond(HttpStatusCode.OK, response)
        }

        post {
            val userId = call.getUserId()
            val request = call.receive<TransactionRequest>()
            val response = transactionService.create(request, userId)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val userId = call.getUserId()
            val id = call.parameters["id"]!!
            val request = call.receive<TransactionRequest>()
            val response = transactionService.update(id, request, userId)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            transactionService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }

        patch("/{id}/restore") {
            val id = call.parameters["id"]!!
            transactionService.restore(id)
            call.respond(HttpStatusCode.OK, mapOf("status" to "restored"))
        }

        get("/{id}/history") {
            val id = call.parameters["id"]!!
            val response = transactionService.getHistory(id)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
