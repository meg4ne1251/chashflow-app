package com.kakeibo.backend.routes

import com.kakeibo.backend.service.TagService
import com.kakeibo.shared.model.TagRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.tagRoutes(tagService: TagService) {
    route("/tags") {
        get {
            val tags = tagService.getAll()
            call.respond(HttpStatusCode.OK, tags)
        }

        post {
            val request = call.receive<TagRequest>()
            val response = tagService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val id = call.parameters["id"]!!
            val request = call.receive<TagRequest>()
            val response = tagService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            tagService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
