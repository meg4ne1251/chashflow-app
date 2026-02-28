package com.kakeibo.backend.routes

import com.kakeibo.backend.service.SuggestionService
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.suggestionRoutes(suggestionService: SuggestionService) {
    route("/suggestions") {
        get("/memos") {
            val keyword = call.request.queryParameters["keyword"] ?: ""
            val suggestions = suggestionService.getMemoSuggestions(keyword)
            call.respond(HttpStatusCode.OK, suggestions)
        }

        get("/auto-complete") {
            val memo = call.request.queryParameters["memo"] ?: ""
            val response = suggestionService.getAutoComplete(memo)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
