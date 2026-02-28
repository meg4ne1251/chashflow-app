package com.kakeibo.backend.config

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.interfaces.DecodedJWT
import com.kakeibo.shared.constants.AppConstants
import io.ktor.server.application.*
import java.util.*

class JwtConfig(environment: ApplicationEnvironment) {
    private val jwtConfig = environment.config.config("jwt")
    val secret: String = jwtConfig.property("secret").getString().also { secret ->
        require(secret.length >= 32) {
            "JWT secret must be at least 32 characters. Set the JWT_SECRET environment variable."
        }
        require(secret != "change-me-in-production-use-a-long-random-string-at-least-256-bits") {
            "JWT secret must be changed from the default value. Set the JWT_SECRET environment variable."
        }
    }
    val issuer: String = jwtConfig.property("issuer").getString()
    val audience: String = jwtConfig.property("audience").getString()
    val realm: String = jwtConfig.property("realm").getString()

    private val algorithm = Algorithm.HMAC256(secret)

    fun generateAccessToken(userId: String, username: String): String {
        return JWT.create()
            .withIssuer(issuer)
            .withAudience(audience)
            .withClaim("user_id", userId)
            .withClaim("username", username)
            .withExpiresAt(Date(System.currentTimeMillis() + AppConstants.ACCESS_TOKEN_EXPIRY_SECONDS * 1000L))
            .sign(algorithm)
    }

    fun generateRefreshToken(): String {
        return UUID.randomUUID().toString() + UUID.randomUUID().toString()
    }

    fun verifyToken(token: String): DecodedJWT {
        val verifier = JWT.require(algorithm)
            .withIssuer(issuer)
            .withAudience(audience)
            .build()
        return verifier.verify(token)
    }

    fun getAlgorithm(): Algorithm = algorithm
}
