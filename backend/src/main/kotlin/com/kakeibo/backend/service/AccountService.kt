package com.kakeibo.backend.service

import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.Transactions
import com.kakeibo.backend.db.Transfers
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.AccountRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.backend.repository.TransferRepository
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class AccountService(
    private val accountRepository: AccountRepository,
    private val transactionRepository: TransactionRepository,
    private val transferRepository: TransferRepository
) {
    fun getAll(): List<AccountResponse> {
        val accounts = accountRepository.findAll()
        if (accounts.isEmpty()) return emptyList()

        // Batch-calculate balances to avoid N+1 queries
        val accountIds = accounts.map { it[Accounts.id] }
        val balanceMap = transaction {
            val incomeMap = mutableMapOf<UUID, Long>()
            val expenseMap = mutableMapOf<UUID, Long>()
            val transferInMap = mutableMapOf<UUID, Long>()
            val transferOutMap = mutableMapOf<UUID, Long>()

            val txAmountSum = Transactions.amount.sum()
            val trAmountSum = Transfers.amount.sum()

            // Income by account
            Transactions.select(Transactions.accountId, txAmountSum)
                .where { (Transactions.type eq "income") and Transactions.deletedAt.isNull() and (Transactions.accountId inList accountIds) }
                .groupBy(Transactions.accountId)
                .forEach { row ->
                    incomeMap[row[Transactions.accountId]] = row[txAmountSum] ?: 0L
                }

            // Expense by account
            Transactions.select(Transactions.accountId, txAmountSum)
                .where { (Transactions.type eq "expense") and Transactions.deletedAt.isNull() and (Transactions.accountId inList accountIds) }
                .groupBy(Transactions.accountId)
                .forEach { row ->
                    expenseMap[row[Transactions.accountId]] = row[txAmountSum] ?: 0L
                }

            // Transfer in
            Transfers.select(Transfers.toAccountId, trAmountSum)
                .where { Transfers.deletedAt.isNull() and (Transfers.toAccountId inList accountIds) }
                .groupBy(Transfers.toAccountId)
                .forEach { row ->
                    transferInMap[row[Transfers.toAccountId]] = row[trAmountSum] ?: 0L
                }

            // Transfer out
            Transfers.select(Transfers.fromAccountId, trAmountSum)
                .where { Transfers.deletedAt.isNull() and (Transfers.fromAccountId inList accountIds) }
                .groupBy(Transfers.fromAccountId)
                .forEach { row ->
                    transferOutMap[row[Transfers.fromAccountId]] = row[trAmountSum] ?: 0L
                }

            accountIds.associateWith { id ->
                val initialBalance = accounts.first { it[Accounts.id] == id }[Accounts.initialBalance]
                initialBalance + (incomeMap[id] ?: 0L) - (expenseMap[id] ?: 0L) +
                    (transferInMap[id] ?: 0L) - (transferOutMap[id] ?: 0L)
            }
        }

        return accounts.map { it.toResponse(balanceMap[it[Accounts.id]] ?: it[Accounts.initialBalance]) }
    }

    fun create(request: AccountRequest): AccountResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        if (accountRepository.existsByName(request.name.trim())) {
            throw ValidationException("同一名称のアカウントが既に存在します",
                listOf(FieldError("name", "アカウント名が重複しています")))
        }

        val row = accountRepository.create(
            id = id,
            name = request.name.trim(),
            type = request.type,
            initialBalance = request.initial_balance,
            currency = request.currency,
            sortOrder = request.sort_order
        )
        return row.toResponse()
    }

    fun update(id: String, request: AccountRequest): AccountResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)

        if (accountRepository.existsByName(request.name.trim(), uuid)) {
            throw ValidationException("同一名称のアカウントが既に存在します",
                listOf(FieldError("name", "アカウント名が重複しています")))
        }

        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val row = accountRepository.update(
            id = uuid, name = request.name.trim(), type = request.type,
            initialBalance = request.initial_balance, currency = request.currency,
            sortOrder = request.sort_order, currentVersion = currentVersion
        )

        if (row == null) {
            val existing = accountRepository.findById(uuid)
                ?: throw NotFoundException("アカウントが見つかりません")
            throw ConflictException("バージョン競合が発生しました")
        }

        return row.toResponse()
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        val existing = accountRepository.findActiveById(uuid)
            ?: throw NotFoundException("アカウントが見つかりません")

        if (!accountRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
        }
    }

    private fun calculateBalance(accountId: UUID, initialBalance: Long): Long {
        val income = transactionRepository.sumByAccountAndType(accountId, "income")
        val expense = transactionRepository.sumByAccountAndType(accountId, "expense")
        val transferIn = transferRepository.sumByAccountDirection(accountId, "to")
        val transferOut = transferRepository.sumByAccountDirection(accountId, "from")
        return initialBalance + income - expense + transferIn - transferOut
    }

    private fun ResultRow.toResponse(precomputedBalance: Long? = null): AccountResponse {
        val id = this[Accounts.id]
        val initialBalance = this[Accounts.initialBalance]
        return AccountResponse(
            id = id.toString(),
            name = this[Accounts.name],
            type = this[Accounts.type],
            initial_balance = initialBalance,
            currency = this[Accounts.currency],
            sort_order = this[Accounts.sortOrder],
            balance = precomputedBalance ?: calculateBalance(id, initialBalance),
            version = this[Accounts.version],
            created_at = this[Accounts.createdAt].toString(),
            updated_at = this[Accounts.updatedAt].toString(),
            deleted_at = this[Accounts.deletedAt]?.toString()
        )
    }

    private fun validateRequest(request: AccountRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.name.isBlank()) errors.add(FieldError("name", "アカウント名を入力してください"))
        if (request.name.length > ValidationRules.ACCOUNT_NAME_MAX_LENGTH)
            errors.add(FieldError("name", "アカウント名は${ValidationRules.ACCOUNT_NAME_MAX_LENGTH}文字以下で入力してください"))
        if (request.type !in com.kakeibo.shared.model.AccountType.entries.map { it.value })
            errors.add(FieldError("type", "アカウント種別が不正です"))
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
