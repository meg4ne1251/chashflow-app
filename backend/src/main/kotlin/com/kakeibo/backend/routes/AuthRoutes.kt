package com.kakeibo.backend.routes

import com.kakeibo.backend.service.AuthService
import com.kakeibo.shared.model.*
import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.authRoutes(authService: AuthService) {
    route("/auth") {
        get("/setup/status") {
            val needsSetup = authService.isSetupRequired()
            call.respond(HttpStatusCode.OK, SetupStatusResponse(needs_setup = needsSetup))
        }

        rateLimit(RateLimitName("auth-setup")) {
            post("/setup") {
                val request = call.receive<SetupRequest>()
                val response = authService.setup(request)
                call.respond(HttpStatusCode.Created, response)
            }
        }

        rateLimit(RateLimitName("auth-login")) {
            post("/login") {
                val request = call.receive<LoginRequest>()
                val response = authService.login(request)
                call.respond(HttpStatusCode.OK, response)
            }
        }

        rateLimit(RateLimitName("auth-login")) {
            post("/refresh") {
                val request = call.receive<RefreshRequest>()
                val response = authService.refresh(request)
                call.respond(HttpStatusCode.OK, response)
            }
        }

        authenticate("auth-jwt") {
            post("/logout") {
                val request = call.receive<LogoutRequest>()
                authService.logout(request)
                call.respond(HttpStatusCode.NoContent)
            }

            put("/password") {
                val principal = call.principal<JWTPrincipal>()!!
                val userId = principal.payload.getClaim("user_id").asString()
                val request = call.receive<PasswordChangeRequest>()
                authService.changePassword(userId, request)
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
}
