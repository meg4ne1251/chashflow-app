package com.kakeibo.backend.routes

import com.kakeibo.backend.service.BudgetService
import com.kakeibo.shared.model.BudgetUpsertRequest
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.budgetRoutes(budgetService: BudgetService) {
    route("/budgets") {
        get {
            val yearMonth = call.request.queryParameters["year_month"]
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "年月を指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("year_month", "year_month クエリパラメータは必須です"))
                )
            val budgets = budgetService.getByYearMonth(yearMonth)
            call.respond(HttpStatusCode.OK, budgets)
        }

        put {
            val request = call.receive<BudgetUpsertRequest>()
            val response = budgetService.upsert(request)
            call.respond(HttpStatusCode.OK, response)
        }

        delete("/{id}") {
            val id = call.parameters["id"]!!
            val version = call.request.queryParameters["version"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "バージョンを指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("version", "version クエリパラメータは必須です"))
                )
            budgetService.delete(id, version)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
