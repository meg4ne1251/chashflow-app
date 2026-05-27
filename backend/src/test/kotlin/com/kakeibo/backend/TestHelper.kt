package com.kakeibo.backend

import com.kakeibo.backend.db.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.transactions.transaction

object TestHelper {
    private var initialized = false

    fun initTestDatabase() {
        if (initialized) return
        Database.connect("jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;MODE=PostgreSQL", driver = "org.h2.Driver")
        transaction {
            SchemaUtils.create(
                Users, RefreshTokens, Accounts, Categories, Tags,
                Transactions, TransactionTags, TransactionHistory,
                Transfers, Templates, TemplateTags,
                RecurringTransactions, RecurringTransactionTags,
                Budgets, NotificationSettings, InputPatterns
            )
        }
        initialized = true
    }

    fun cleanDatabase() {
        // 子テーブル（FK を持つ側）から順に削除する。
        // 特に Transactions は recurring_transaction_id で RecurringTransactions を参照するため、
        // 自動生成された取引が存在する場合は Transactions を RecurringTransactions より先に消す必要がある。
        transaction {
            InputPatterns.deleteAll()
            NotificationSettings.deleteAll()
            Budgets.deleteAll()
            TransactionTags.deleteAll()
            TransactionHistory.deleteAll()
            Transactions.deleteAll()
            RecurringTransactionTags.deleteAll()
            RecurringTransactions.deleteAll()
            TemplateTags.deleteAll()
            Templates.deleteAll()
            Transfers.deleteAll()
            Tags.deleteAll()
            Categories.deleteAll()
            Accounts.deleteAll()
            RefreshTokens.deleteAll()
            Users.deleteAll()
        }
    }
}

