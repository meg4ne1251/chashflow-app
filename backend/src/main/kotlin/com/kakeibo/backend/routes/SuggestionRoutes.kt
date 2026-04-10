package com.kakeibo.backend.routes

import com.kakeibo.backend.service.SuggestionService
import com.kakeibo.shared.validation.ValidationRules
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.suggestionRoutes(suggestionService: SuggestionService) {
    route("/suggestions") {
        get("/memos") {
            val keyword = (call.request.queryParameters["keyword"] ?: "")
                .take(ValidationRules.KEYWORD_MAX_LENGTH)
            val suggestions = suggestionService.getMemoSuggestions(keyword)
            call.respond(HttpStatusCode.OK, suggestions)
        }

        get("/auto-complete") {
            val memo = (call.request.queryParameters["memo"] ?: "")
                .take(ValidationRules.MEMO_MAX_LENGTH)
            val response = suggestionService.getAutoComplete(memo)
            call.respond(HttpStatusCode.OK, response)
        }
    }
}
