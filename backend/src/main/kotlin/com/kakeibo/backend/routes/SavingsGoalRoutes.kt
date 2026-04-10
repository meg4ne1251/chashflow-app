package com.kakeibo.backend.routes

import com.kakeibo.backend.service.SavingsGoalService
import com.kakeibo.shared.model.SavingsGoalRequest
import com.kakeibo.shared.model.SavingsDepositRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.savingsGoalRoutes(savingsGoalService: SavingsGoalService) {
    route("/savings-goals") {
        get {
            val goals = savingsGoalService.getAll()
            call.respond(HttpStatusCode.OK, goals)
        }

        get("/summary") {
            val summaries = savingsGoalService.getActiveSummaries()
            call.respond(HttpStatusCode.OK, summaries)
        }

        get("/{id}") {
            val id = validateUuidParam(call.parameters["id"])
            val goal = savingsGoalService.getById(id)
            call.respond(HttpStatusCode.OK, goal)
        }

        post {
            val request = call.receive<SavingsGoalRequest>()
            val response = savingsGoalService.create(request)
            call.respond(HttpStatusCode.Created, response)
        }

        put("/{id}") {
            val id = validateUuidParam(call.parameters["id"])
            val request = call.receive<SavingsGoalRequest>()
            val response = savingsGoalService.update(id, request)
            call.respond(HttpStatusCode.OK, response)
        }

        patch("/{id}/deposit") {
            val id = validateUuidParam(call.parameters["id"])
            val body = call.receive<SavingsDepositRequest>()
            val response = savingsGoalService.deposit(id, body)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = validateUuidParam(call.parameters["id"])
            val version = validateVersionParam(call.request.queryParameters["version"]?.toIntOrNull())
            savingsGoalService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
