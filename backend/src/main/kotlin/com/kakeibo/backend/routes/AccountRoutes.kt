package com.kakeibo.backend.routes

import com.kakeibo.backend.service.AccountService
import com.kakeibo.shared.model.AccountRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.accountRoutes(accountService: AccountService) {
    route("/accounts") {
        get {
            val accounts = accountService.getAll()
            call.respond(HttpStatusCode.OK, accounts)
        }

        post {
            val request = call.receive<AccountRequest>()
            val response = accountService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val request = call.receive<AccountRequest>()
            val response = accountService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            accountService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
