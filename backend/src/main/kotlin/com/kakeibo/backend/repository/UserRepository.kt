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
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

class UserRepository {
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
            it[Users.createdAt] = now
            it[Users.updatedAt] = now
        }
        UserEntity(id, username, passwordHash, now, now)
    }

    fun updatePassword(userId: UUID, passwordHash: String) = transaction {
        Users.update({ Users.id eq userId }) {
            it[Users.passwordHash] = passwordHash
            it[Users.updatedAt] = OffsetDateTime.now()
        }
    }

    private fun ResultRow.toUserEntity() = UserEntity(
        id = this[Users.id],
        username = this[Users.username],
        passwordHash = this[Users.passwordHash],
        createdAt = this[Users.createdAt],
        updatedAt = this[Users.updatedAt]
    )
}
