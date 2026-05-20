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
    fun getAll(excludeSavings: Boolean = true): List<AccountResponse> {
        val accounts = accountRepository.findAll()
            .let { if (excludeSavings) it.filter { row -> row[Accounts.type] != "savings" } else it }
        if (accounts.isEmpty()) return emptyList()

        val initialBalances = accounts.associate { it[Accounts.id] to it[Accounts.initialBalance] }
        val balanceMap = calculateBalances(initialBalances)

        return accounts.map { it.toResponse(balanceMap[it[Accounts.id]] ?: it[Accounts.initialBalance]) }
    }

    /**
     * 指定された口座群の実残高 (初期残高 + 収入 - 支出 + 振替IN - 振替OUT) を 1 トランザクション・
     * 各集計 1 クエリのバッチ計算で返す。N+1 を避ける目的で公開している。
     *
     * @param initialBalances 集計対象の口座 ID → 初期残高 のマップ。初期残高をクエリし直さないため呼び出し側で渡す。
     * @return 各口座 ID に対する計算済み残高。空入力なら空マップ。
     */
    fun calculateBalances(initialBalances: Map<UUID, Long>): Map<UUID, Long> {
        if (initialBalances.isEmpty()) return emptyMap()
        val accountIds = initialBalances.keys.toList()

        return transaction {
            val incomeMap = mutableMapOf<UUID, Long>()
            val expenseMap = mutableMapOf<UUID, Long>()
            val transferInMap = mutableMapOf<UUID, Long>()
            val transferOutMap = mutableMapOf<UUID, Long>()

            val txAmountSum = Transactions.amount.sum()
            val trAmountSum = Transfers.amount.sum()

            Transactions.select(Transactions.accountId, txAmountSum)
                .where { (Transactions.type eq "income") and Transactions.deletedAt.isNull() and (Transactions.accountId inList accountIds) }
                .groupBy(Transactions.accountId)
                .forEach { row ->
                    row[Transactions.accountId]?.let { incomeMap[it] = row[txAmountSum] ?: 0L }
                }

            Transactions.select(Transactions.accountId, txAmountSum)
                .where { (Transactions.type eq "expense") and Transactions.deletedAt.isNull() and (Transactions.accountId inList accountIds) }
                .groupBy(Transactions.accountId)
                .forEach { row ->
                    row[Transactions.accountId]?.let { expenseMap[it] = row[txAmountSum] ?: 0L }
                }

            Transfers.select(Transfers.toAccountId, trAmountSum)
                .where { Transfers.deletedAt.isNull() and (Transfers.toAccountId inList accountIds) }
                .groupBy(Transfers.toAccountId)
                .forEach { row ->
                    transferInMap[row[Transfers.toAccountId]] = row[trAmountSum] ?: 0L
                }

            Transfers.select(Transfers.fromAccountId, trAmountSum)
                .where { Transfers.deletedAt.isNull() and (Transfers.fromAccountId inList accountIds) }
                .groupBy(Transfers.fromAccountId)
                .forEach { row ->
                    transferOutMap[row[Transfers.fromAccountId]] = row[trAmountSum] ?: 0L
                }

            accountIds.associateWith { id ->
                (initialBalances[id] ?: 0L) +
                    (incomeMap[id] ?: 0L) -
                    (expenseMap[id] ?: 0L) +
                    (transferInMap[id] ?: 0L) -
                    (transferOutMap[id] ?: 0L)
            }
        }
    }

    fun create(request: AccountRequest): AccountResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        if (accountRepository.existsByName(request.name.trim())) {
            throw ValidationException("同一名称の決済手段が既に存在します",
                listOf(FieldError("name", "決済手段名が重複しています")))
        }

        val paymentDay = if (request.type == "credit_card") request.payment_day else null
        val row = accountRepository.create(
            id = id,
            name = request.name.trim(),
            type = request.type,
            initialBalance = request.initial_balance,
            currency = request.currency,
            sortOrder = request.sort_order,
            paymentDay = paymentDay
        )
        return row.toResponse()
    }

    fun update(id: String, request: AccountRequest): AccountResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)

        if (accountRepository.existsByName(request.name.trim(), uuid)) {
            throw ValidationException("同一名称の決済手段が既に存在します",
                listOf(FieldError("name", "決済手段名が重複しています")))
        }

        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val paymentDay = if (request.type == "credit_card") request.payment_day else null
        val row = accountRepository.update(
            id = uuid, name = request.name.trim(), type = request.type,
            initialBalance = request.initial_balance, currency = request.currency,
            sortOrder = request.sort_order, currentVersion = currentVersion,
            paymentDay = paymentDay
        )

        if (row == null) {
            val existing = accountRepository.findById(uuid)
                ?: throw NotFoundException("決済手段が見つかりません")
            throw ConflictException("バージョン競合が発生しました")
        }

        return row.toResponse()
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        val existing = accountRepository.findActiveById(uuid)
            ?: throw NotFoundException("決済手段が見つかりません")

        if (existing[Accounts.type] == "savings") {
            throw ValidationException("貯蓄口座は貯蓄目標から削除してください",
                listOf(FieldError("type", "貯蓄口座は直接削除できません")))
        }

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
            payment_day = this[Accounts.paymentDay],
            balance = precomputedBalance ?: calculateBalance(id, initialBalance),
            version = this[Accounts.version],
            created_at = this[Accounts.createdAt].toString(),
            updated_at = this[Accounts.updatedAt].toString(),
            deleted_at = this[Accounts.deletedAt]?.toString()
        )
    }

    private fun validateRequest(request: AccountRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.name.isBlank()) errors.add(FieldError("name", "決済手段名を入力してください"))
        if (request.name.length > ValidationRules.ACCOUNT_NAME_MAX_LENGTH)
            errors.add(FieldError("name", "決済手段名は${ValidationRules.ACCOUNT_NAME_MAX_LENGTH}文字以下で入力してください"))
        if (request.type !in com.kakeibo.shared.model.AccountType.entries.map { it.value })
            errors.add(FieldError("type", "決済手段種別が不正です"))
        if (request.type == "savings")
            errors.add(FieldError("type", "貯蓄口座は直接作成できません"))
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
