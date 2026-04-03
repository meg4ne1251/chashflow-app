package com.kakeibo.backend.routes

import com.kakeibo.backend.service.AnalyticsService
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.analyticsRoutes(analyticsService: AnalyticsService) {
    route("/analytics") {
        get("/dashboard") {
            val response = analyticsService.getDashboard()
            call.respond(HttpStatusCode.OK, response)
        }

        get("/category-breakdown") {
            val yearMonth = call.request.queryParameters["year_month"]
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "年月を指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("year_month", "year_month クエリパラメータは必須です"))
                )
            val type = call.request.queryParameters["type"]
            val response = analyticsService.getCategoryBreakdown(yearMonth, type)
            call.respond(HttpStatusCode.OK, response)
        }

        get("/trends") {
            val from = call.request.queryParameters["from"]
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "開始年月を指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("from", "from クエリパラメータは必須です"))
                )
            val to = call.request.queryParameters["to"]
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "終了年月を指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("to", "to クエリパラメータは必須です"))
                )
            val response = analyticsService.getTrends(from, to)
            call.respond(HttpStatusCode.OK, response)
        }

        get("/comparison") {
            val yearMonth = call.request.queryParameters["year_month"]
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "年月を指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("year_month", "year_month クエリパラメータは必須です"))
                )
            val response = analyticsService.getComparison(yearMonth)
            call.respond(HttpStatusCode.OK, response)
        }

        get("/yearly/{year}") {
            val year = call.parameters["year"]?.toIntOrNull()
                ?: throw com.kakeibo.backend.middleware.ValidationException(
                    "年を指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("year", "有効な年を指定してください"))
                )
            if (year !in 2000..2100) {
                throw com.kakeibo.backend.middleware.ValidationException(
                    "年は2000〜2100の範囲で指定してください",
                    listOf(com.kakeibo.shared.model.FieldError("year", "年は2000〜2100の範囲で指定してください"))
                )
            }
            val response = analyticsService.getYearlySummary(year)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
