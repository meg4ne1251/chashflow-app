package com.kakeibo.backend.routes

import com.kakeibo.backend.service.RecurringTransactionService
import com.kakeibo.shared.model.RecurringTransactionRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.recurringTransactionRoutes(recurringTransactionService: RecurringTransactionService) {
    route("/recurring-transactions") {
        get {
            val transactions = recurringTransactionService.getAll()
            call.respond(HttpStatusCode.OK, transactions)
        }

        post {
            val request = call.receive<RecurringTransactionRequest>()
            val response = recurringTransactionService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val request = call.receive<RecurringTransactionRequest>()
            val response = recurringTransactionService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            recurringTransactionService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }

        patch("/{id}/toggle") {
            val id = call.parameters["id"]!!
            val response = recurringTransactionService.toggle(id)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
