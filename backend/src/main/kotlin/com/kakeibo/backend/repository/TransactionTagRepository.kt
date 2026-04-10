package com.kakeibo.backend.repository

import com.kakeibo.backend.db.TransactionTags
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class TransactionTagRepository {
    fun findByTransactionId(transactionId: UUID): List<UUID> = transaction {
        TransactionTags.selectAll()
            .where { TransactionTags.transactionId eq transactionId }
            .map { it[TransactionTags.tagId] }
    }

    /**
     * Batch-load tag IDs for multiple transactions at once (N+1 prevention).
     * Returns Map<transactionId, List<tagId>>.
     */
    fun findByTransactionIds(transactionIds: List<UUID>): Map<UUID, List<UUID>> = transaction {
        if (transactionIds.isEmpty()) return@transaction emptyMap()
        TransactionTags.selectAll()
            .where { TransactionTags.transactionId inList transactionIds }
            .groupBy({ it[TransactionTags.transactionId] }, { it[TransactionTags.tagId] })
    }

    fun setTags(transactionId: UUID, tagIds: List<UUID>) = transaction {
        TransactionTags.deleteWhere { TransactionTags.transactionId eq transactionId }
        if (tagIds.isNotEmpty()) {
            TransactionTags.batchInsert(tagIds) { tagId ->
                this[TransactionTags.transactionId] = transactionId
                this[TransactionTags.tagId] = tagId
            }
        }
    }

    fun deleteByTransactionId(transactionId: UUID) = transaction {
        TransactionTags.deleteWhere { TransactionTags.transactionId eq transactionId }
    }

    fun deleteByTagId(tagId: UUID) = transaction {
        TransactionTags.deleteWhere { TransactionTags.tagId eq tagId }
    }

    fun countByTagId(tagId: UUID): Long = transaction {
        TransactionTags.selectAll()
            .where { TransactionTags.tagId eq tagId }
            .count()
    }
}
