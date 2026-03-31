package com.kakeibo.backend.repository

import com.kakeibo.backend.db.Users
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

data class UserEntity(
    val id: UUID,
    val username: String,
    val passwordHash: String,
    val failedAttempts: Int,
    val lockedUntil: OffsetDateTime?,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

class UserRepository {
    companion object {
        const val MAX_FAILED_ATTEMPTS = 5
        const val LOCK_DURATION_MINUTES = 15L
    }

    fun findByUsername(username: String): UserEntity? = transaction {
        Users.selectAll().where { Users.username eq username }
            .map { it.toUserEntity() }
            .singleOrNull()
    }

    fun findById(id: UUID): UserEntity? = transaction {
        Users.selectAll().where { Users.id eq id }
            .map { it.toUserEntity() }
            .singleOrNull()
    }

    fun count(): Long = transaction {
        Users.selectAll().count()
    }

    fun create(username: String, passwordHash: String): UserEntity = transaction {
        val now = OffsetDateTime.now()
        val id = UUID.randomUUID()
        Users.insert {
            it[Users.id] = id
            it[Users.username] = username
            it[Users.passwordHash] = passwordHash
            it[Users.failedAttempts] = 0
            it[Users.lockedUntil] = null
            it[Users.createdAt] = now
            it[Users.updatedAt] = now
        }
        UserEntity(id, username, passwordHash, 0, null, now, now)
    }

    fun updatePassword(userId: UUID, passwordHash: String) = transaction {
        Users.update({ Users.id eq userId }) {
            it[Users.passwordHash] = passwordHash
            it[Users.updatedAt] = OffsetDateTime.now()
        }
    }

    /**
     * ログイン失敗回数をインクリメントし、現在の失敗回数を返す
     */
    fun incrementFailedAttempts(userId: UUID): Int = transaction {
        Users.update({ Users.id eq userId }) {
            with(SqlExpressionBuilder) {
                it[failedAttempts] = failedAttempts + 1
            }
            it[updatedAt] = OffsetDateTime.now()
        }
        
        Users.selectAll().where { Users.id eq userId }
            .single()[Users.failedAttempts]
    }

    /**
     * ログイン失敗回数をリセット
     */
    fun resetFailedAttempts(userId: UUID) = transaction {
        Users.update({ Users.id eq userId }) {
            it[failedAttempts] = 0
            it[lockedUntil] = null
            it[updatedAt] = OffsetDateTime.now()
        }
    }

    /**
     * アカウントをロック
     */
    fun lockAccount(userId: UUID, unlockAt: OffsetDateTime) = transaction {
        Users.update({ Users.id eq userId }) {
            it[lockedUntil] = unlockAt
            it[updatedAt] = OffsetDateTime.now()
        }
    }

    /**
     * アカウントロックを解除（手動解除用）
     */
    fun unlockAccount(userId: UUID) = transaction {
        Users.update({ Users.id eq userId }) {
            it[failedAttempts] = 0
            it[lockedUntil] = null
            it[updatedAt] = OffsetDateTime.now()
        }
    }

    private fun ResultRow.toUserEntity() = UserEntity(
        id = this[Users.id],
        username = this[Users.username],
        passwordHash = this[Users.passwordHash],
        failedAttempts = this[Users.failedAttempts],
        lockedUntil = this[Users.lockedUntil],
        createdAt = this[Users.createdAt],
        updatedAt = this[Users.updatedAt]
    )
}
