package com.kakeibo.backend.middleware

import io.ktor.server.application.*
import io.ktor.server.plugins.ratelimit.*
import kotlin.time.Duration.Companion.minutes

fun Application.configureRateLimiting() {
    install(RateLimit) {
        register(RateLimitName("auth-login")) {
            rateLimiter(limit = 5, refillPeriod = 1.minutes)
        }
        register(RateLimitName("auth-setup")) {
            rateLimiter(limit = 3, refillPeriod = 1.minutes)
        }
        register(RateLimitName("api-general")) {
            rateLimiter(limit = 60, refillPeriod = 1.minutes)
        }
    }
}
