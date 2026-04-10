package com.kakeibo.backend.repository

import com.kakeibo.backend.db.RefreshTokens
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNotNull
import org.jetbrains.exposed.sql.transactions.transaction
import java.security.MessageDigest
import java.time.OffsetDateTime
import java.util.*

class RefreshTokenRepository {

    fun create(userId: UUID, tokenHash: String, expiresAt: OffsetDateTime) = transaction {
        RefreshTokens.insert {
            it[RefreshTokens.userId] = userId
            it[RefreshTokens.tokenHash] = tokenHash
            it[RefreshTokens.expiresAt] = expiresAt
            it[RefreshTokens.createdAt] = OffsetDateTime.now()
        }
    }

    fun findByTokenHash(tokenHash: String) = transaction {
        RefreshTokens.selectAll()
            .where { RefreshTokens.tokenHash eq tokenHash }
            .singleOrNull()
            ?.let {
                RefreshTokenEntity(
                    id = it[RefreshTokens.id],
                    userId = it[RefreshTokens.userId],
                    tokenHash = it[RefreshTokens.tokenHash],
                    expiresAt = it[RefreshTokens.expiresAt],
                    createdAt = it[RefreshTokens.createdAt],
                    revokedAt = it[RefreshTokens.revokedAt]
                )
            }
    }

    fun revoke(tokenHash: String): Int = transaction {
        RefreshTokens.update({ RefreshTokens.tokenHash eq tokenHash }) {
            it[RefreshTokens.revokedAt] = OffsetDateTime.now()
        }
    }

    /**
     * Atomically revoke only if the token is not already revoked.
     * Returns the number of rows affected (1 if the caller successfully revoked it,
     * 0 if it was already revoked — used to detect concurrent reuse).
     */
    fun revokeIfActive(tokenHash: String): Int = transaction {
        RefreshTokens.update({
            (RefreshTokens.tokenHash eq tokenHash) and RefreshTokens.revokedAt.isNull()
        }) {
            it[RefreshTokens.revokedAt] = OffsetDateTime.now()
        }
    }

    fun revokeAllForUser(userId: UUID) = transaction {
        RefreshTokens.update({
            (RefreshTokens.userId eq userId) and RefreshTokens.revokedAt.isNull()
        }) {
            it[RefreshTokens.revokedAt] = OffsetDateTime.now()
        }
    }

    fun cleanupExpired() = transaction {
        val cutoff = OffsetDateTime.now().minusDays(30)
        RefreshTokens.deleteWhere {
            (RefreshTokens.expiresAt less OffsetDateTime.now()) or
                    (RefreshTokens.revokedAt.isNotNull() and (RefreshTokens.revokedAt less cutoff))
        }
    }

    companion object {
        fun hashToken(token: String): String {
            val digest = MessageDigest.getInstance("SHA-256")
            return digest.digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
        }
    }
}

data class RefreshTokenEntity(
    val id: UUID,
    val userId: UUID,
    val tokenHash: String,
    val expiresAt: OffsetDateTime,
    val createdAt: OffsetDateTime,
    val revokedAt: OffsetDateTime?
)
