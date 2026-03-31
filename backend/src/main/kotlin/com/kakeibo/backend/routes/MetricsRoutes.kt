package com.kakeibo.backend.routes

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry

fun Route.metricsRoutes(registry: PrometheusMeterRegistry) {
    // Prometheusスクレイピング用エンドポイント
    // 注意: 本番環境ではIP制限またはBasic認証を追加すること
    get("/metrics") {
        call.respondText(
            registry.scrape(),
            contentType = ContentType.Text.Plain
        )
    }
}
