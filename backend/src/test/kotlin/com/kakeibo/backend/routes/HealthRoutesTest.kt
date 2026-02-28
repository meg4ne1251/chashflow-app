package com.kakeibo.backend.routes

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import kotlin.test.*

class HealthRoutesTest {

    @Test
    fun `GET health - returns health status`() = testApplication {
        application {
            install(ContentNegotiation) {
                json(Json {
                    prettyPrint = false
                    isLenient = false
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                })
            }
            routing {
                route("/api/v1") {
                    healthRoutes()
                }
            }
        }

        val response = client.get("/api/v1/health")

        // Without a database connection, it will return error status
        // but the endpoint itself should respond
        val body = response.bodyAsText()
        assertTrue(body.contains("status"))
        assertTrue(body.contains("version"))
    }
}
