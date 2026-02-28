package com.kakeibo.backend.routes

import com.kakeibo.backend.service.CategoryService
import com.kakeibo.shared.model.CategoryRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.categoryRoutes(categoryService: CategoryService) {
    route("/categories") {
        get {
            val type = call.request.queryParameters["type"]
            val categories = categoryService.getAll(type)
            call.respond(HttpStatusCode.OK, categories)
        }

        post {
            val request = call.receive<CategoryRequest>()
            val response = categoryService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val request = call.receive<CategoryRequest>()
            val response = categoryService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            categoryService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
