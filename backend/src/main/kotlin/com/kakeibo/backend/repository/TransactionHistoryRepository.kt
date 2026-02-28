package com.kakeibo.backend.repository

import com.kakeibo.backend.db.TransactionHistory
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.util.*

class TransactionHistoryRepository {
    fun findByTransactionId(transactionId: UUID): List<ResultRow> = transaction {
        TransactionHistory.selectAll()
            .where { TransactionHistory.transactionId eq transactionId }
            .orderBy(TransactionHistory.changedAt to SortOrder.DESC)
            .toList()
    }

    fun create(
        transactionId: UUID, userId: UUID, changedFields: String,
        versionBefore: Int, versionAfter: Int
    ) = transaction {
        val now = OffsetDateTime.now()
        TransactionHistory.insert {
            it[TransactionHistory.transactionId] = transactionId
            it[TransactionHistory.userId] = userId
            it[TransactionHistory.changedFields] = changedFields
            it[TransactionHistory.changedAt] = now
            it[TransactionHistory.versionBefore] = versionBefore
            it[TransactionHistory.versionAfter] = versionAfter
            it[TransactionHistory.createdAt] = now
            it[TransactionHistory.updatedAt] = now
        }

        // Enforce max history records per transaction
        trimHistory(transactionId)
    }

    private fun trimHistory(transactionId: UUID) {
        val maxHistory = ValidationRules.MAX_HISTORY_PER_TRANSACTION
        val count = TransactionHistory.selectAll()
            .where { TransactionHistory.transactionId eq transactionId }
            .count()

        if (count > maxHistory) {
            val oldestToDelete = TransactionHistory.selectAll()
                .where { TransactionHistory.transactionId eq transactionId }
                .orderBy(TransactionHistory.changedAt to SortOrder.ASC)
                .limit((count - maxHistory).toInt())
                .map { it[TransactionHistory.id] }

            TransactionHistory.deleteWhere { TransactionHistory.id inList oldestToDelete }
        }
    }

    fun deleteByTransactionId(transactionId: UUID) = transaction {
        TransactionHistory.deleteWhere { TransactionHistory.transactionId eq transactionId }
    }
}
