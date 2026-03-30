package com.kakeibo.backend.routes

import com.kakeibo.backend.service.TemplateService
import com.kakeibo.shared.model.TemplateRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.templateRoutes(templateService: TemplateService) {
    route("/templates") {
        get {
            val templates = templateService.getAll()
            call.respond(HttpStatusCode.OK, templates)
        }

        post {
            val request = call.receive<TemplateRequest>()
            val response = templateService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        post("/{id}/use") {
            val id = validateUuidParam(call.parameters["id"])
            templateService.recordUse(id)
            call.respond(HttpStatusCode.NoContent)
        }

        put("/{id}") {
            val id = validateUuidParam(call.parameters["id"])
            val request = call.receive<TemplateRequest>()
            val response = templateService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = validateUuidParam(call.parameters["id"])
            val version = validateVersionParam(call.request.queryParameters["version"]?.toIntOrNull())
            templateService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
