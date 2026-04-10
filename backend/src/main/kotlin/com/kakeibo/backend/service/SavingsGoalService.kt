package com.kakeibo.backend.service

import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.SavingsGoals
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.AccountRepository
import com.kakeibo.backend.repository.NotificationRepository
import com.kakeibo.backend.repository.NotificationSettingRepository
import com.kakeibo.backend.repository.SavingsGoalRepository
import com.kakeibo.backend.repository.TransferRepository
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit
import java.util.*

class SavingsGoalService(
    private val savingsGoalRepository: SavingsGoalRepository,
    private val accountRepository: AccountRepository,
    private val transferRepository: TransferRepository,
    private val notificationRepository: NotificationRepository,
    private val notificationSettingRepository: NotificationSettingRepository
) {
    fun getAll(): List<SavingsGoalResponse> {
        val goals = savingsGoalRepository.findAll()
        val accountIds = goals.mapNotNull { it[SavingsGoals.accountId] }.distinct()
        val accountMap = if (accountIds.isNotEmpty()) {
            accountRepository.findByIds(accountIds).associateBy { it[Accounts.id] }
        } else emptyMap()
        val balanceMap = computeSavingsBalances(accountMap)
        return goals.map { it.toResponse(accountMap, balanceMap) }
    }

    fun getById(id: String): SavingsGoalResponse {
        val uuid = UUID.fromString(id)
        val goal = savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")
        val accountMap = goal[SavingsGoals.accountId]?.let { accId ->
            accountRepository.findById(accId)?.let { mapOf(accId to it) }
        } ?: emptyMap()
        val balanceMap = computeSavingsBalances(accountMap)
        return goal.toResponse(accountMap, balanceMap)
    }

    fun getActiveSummaries(): List<SavingsGoalSummary> {
        val goals = savingsGoalRepository.findActive()
        val accountIds = goals.mapNotNull { it[SavingsGoals.accountId] }.distinct()
        val accountMap = if (accountIds.isNotEmpty()) {
            accountRepository.findByIds(accountIds).associateBy { it[Accounts.id] }
        } else emptyMap()
        val balanceMap = computeSavingsBalances(accountMap)
        return goals.map { it.toSummary(balanceMap) }
    }

    fun create(request: SavingsGoalRequest): SavingsGoalResponse {
        validateRequest(request)
        val goalId = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        return transaction {
            // Create a savings account for this goal
            val savingsAccountId = UUID.randomUUID()
            accountRepository.create(
                id = savingsAccountId,
                name = "【貯蓄】${request.name}",
                type = "savings",
                initialBalance = 0,
                currency = request.currency,
                sortOrder = 9999
            )

            val row = savingsGoalRepository.create(
                id = goalId,
                name = request.name,
                targetAmount = request.target_amount,
                currentAmount = 0,
                currency = request.currency,
                deadline = request.deadline?.let { LocalDate.parse(it) },
                accountId = savingsAccountId,
                icon = request.icon,
                color = request.color,
                sortOrder = request.sort_order
            )
            row.toResponse(emptyMap(), emptyMap())
        }
    }

    fun update(id: String, request: SavingsGoalRequest): SavingsGoalResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)
        val version = request.version ?: throw ValidationException(
            "バージョンを指定してください",
            listOf(FieldError("version", "version は必須です"))
        )
        val existing = savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")

        val existingAccountId = existing[SavingsGoals.accountId]
        val existingCurrentAmount = existing[SavingsGoals.currentAmount]

        return transaction {
            val row = savingsGoalRepository.update(
                id = uuid,
                name = request.name,
                targetAmount = request.target_amount,
                currentAmount = existingCurrentAmount,
                currency = request.currency,
                deadline = request.deadline?.let { LocalDate.parse(it) },
                accountId = existingAccountId,
                icon = request.icon,
                color = request.color,
                sortOrder = request.sort_order,
                currentVersion = version
            ) ?: throw ConflictException("バージョン競合が発生しました")

            // Rename linked savings account if goal name changed
            if (existingAccountId != null && request.name != existing[SavingsGoals.name]) {
                val account = accountRepository.findById(existingAccountId)
                if (account != null && account[Accounts.type] == "savings") {
                    accountRepository.updateName(
                        existingAccountId,
                        "【貯蓄】${request.name}",
                        account[Accounts.version]
                    )
                }
            }

            checkAndNotifyAchievement(row)

            val accountMap = existingAccountId?.let { accId ->
                accountRepository.findById(accId)?.let { mapOf(accId to it) }
            } ?: emptyMap()
            val balanceMap = computeSavingsBalances(accountMap)
            row.toResponse(accountMap, balanceMap)
        }
    }

    fun deposit(goalId: String, request: SavingsDepositRequest): SavingsGoalResponse {
        val uuid = UUID.fromString(goalId)
        val goal = savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")

        val savingsAccountId = goal[SavingsGoals.accountId]
            ?: throw ValidationException("貯蓄目標にリンクされた口座がありません",
                listOf(FieldError("account_id", "口座が紐付いていません")))

        val errors = mutableListOf<FieldError>()
        if (!ValidationRules.validateUuid(request.from_account_id))
            errors.add(FieldError("from_account_id", "出金元決済手段IDの形式が不正です"))
        if (request.amount <= 0)
            errors.add(FieldError("amount", "積立額は1以上の値を指定してください"))
        if (request.amount > ValidationRules.AMOUNT_MAX)
            errors.add(FieldError("amount", "積立額が上限を超えています"))
        val date = request.date?.let {
            try { LocalDate.parse(it) }
            catch (_: Exception) {
                errors.add(FieldError("date", "日付の形式が不正です（YYYY-MM-DD）"))
                null
            }
        } ?: LocalDate.now()
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)

        val fromAccountId = UUID.fromString(request.from_account_id)
        if (fromAccountId == savingsAccountId) {
            throw ValidationException("出金元と入金先に同一決済手段は指定できません",
                listOf(FieldError("from_account_id", "出金元と入金先が同じです")))
        }

        accountRepository.findActiveById(fromAccountId)
            ?: throw NotFoundException("出金元の決済手段が見つかりません")

        return transaction {
            // Create a transfer from source account to savings account
            transferRepository.create(
                id = UUID.randomUUID(),
                fromAccountId = fromAccountId,
                toAccountId = savingsAccountId,
                amount = request.amount,
                currency = goal[SavingsGoals.currency],
                date = date,
                memo = request.memo ?: "貯蓄目標「${goal[SavingsGoals.name]}」への積立"
            )

            // Recompute balance and update current_amount
            val newBalance = computeSavingsBalance(savingsAccountId)
            val row = savingsGoalRepository.updateCurrentAmount(uuid, newBalance, goal[SavingsGoals.version])
                ?: throw ConflictException("バージョン競合が発生しました")

            checkAndNotifyAchievement(row)

            val accountMap = accountRepository.findById(savingsAccountId)?.let { mapOf(savingsAccountId to it) } ?: emptyMap()
            val balanceMap = mapOf(savingsAccountId to newBalance)
            row.toResponse(accountMap, balanceMap)
        }
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        val goal = savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")

        transaction {
            if (!savingsGoalRepository.softDelete(uuid, version)) {
                throw ConflictException("バージョン競合が発生しました")
            }
            // Also soft-delete the linked savings account
            val accountId = goal[SavingsGoals.accountId]
            if (accountId != null) {
                val account = accountRepository.findActiveById(accountId)
                if (account != null && account[Accounts.type] == "savings") {
                    accountRepository.softDelete(accountId, account[Accounts.version])
                }
            }
        }
    }

    private fun checkAndNotifyAchievement(row: ResultRow) {
        if (row[SavingsGoals.status] == "achieved") {
            val setting = notificationSettingRepository.findByType("savings_goal_achieved")
            if (setting != null && setting[com.kakeibo.backend.db.NotificationSettings.isEnabled]) {
                val name = row[SavingsGoals.name]
                val amount = row[SavingsGoals.targetAmount]
                notificationRepository.create(
                    type = "savings_goal_achieved",
                    title = "貯蓄目標を達成しました！",
                    message = "「${name}」の目標額 ¥${String.format("%,d", amount)} を達成しました。おめでとうございます！"
                )
            }
        }
    }

    private fun computeSavingsBalance(accountId: UUID): Long {
        val account = accountRepository.findById(accountId) ?: return 0L
        val initialBalance = account[Accounts.initialBalance]
        val transferIn = transferRepository.sumByAccountDirection(accountId, "to")
        val transferOut = transferRepository.sumByAccountDirection(accountId, "from")
        return initialBalance + transferIn - transferOut
    }

    private fun computeSavingsBalances(accountMap: Map<UUID, ResultRow>): Map<UUID, Long> {
        // N+1 回避: 貯蓄口座ごとにループで sumByAccountDirection を呼ばず、
        // 流入/流出をそれぞれ 1 クエリで集計する。
        val savingsAccounts = accountMap.filter { (_, row) -> row[Accounts.type] == "savings" }
        if (savingsAccounts.isEmpty()) return emptyMap()

        val ids = savingsAccounts.keys.toList()
        val inflow = transferRepository.sumByAccountDirectionBatch(ids, "to")
        val outflow = transferRepository.sumByAccountDirectionBatch(ids, "from")

        return savingsAccounts.mapValues { (id, row) ->
            val initialBalance = row[Accounts.initialBalance]
            val transferIn = inflow[id] ?: 0L
            val transferOut = outflow[id] ?: 0L
            initialBalance + transferIn - transferOut
        }
    }

    private fun ResultRow.toResponse(accountMap: Map<UUID, ResultRow>, balanceMap: Map<UUID, Long>): SavingsGoalResponse {
        val target = this[SavingsGoals.targetAmount]
        val accId = this[SavingsGoals.accountId]
        // Derive current_amount from savings account balance if available
        val current = if (accId != null && balanceMap.containsKey(accId)) {
            balanceMap[accId]!!
        } else {
            this[SavingsGoals.currentAmount]
        }
        val remaining = maxOf(target - current, 0)
        val progressRate = if (target > 0) (current.toDouble() / target.toDouble()) * 100.0 else 0.0
        val deadlineVal = this[SavingsGoals.deadline]
        val monthlyRecommended = calculateMonthlyRecommended(remaining, deadlineVal)
        val accRow = accId?.let { accountMap[it] }

        return SavingsGoalResponse(
            id = this[SavingsGoals.id].toString(),
            name = this[SavingsGoals.name],
            target_amount = target,
            current_amount = current,
            currency = this[SavingsGoals.currency],
            deadline = deadlineVal?.toString(),
            account_id = accId?.toString(),
            account = accRow?.let {
                val balance = balanceMap[accId] ?: 0L
                AccountResponse(
                    id = it[Accounts.id].toString(),
                    name = it[Accounts.name],
                    type = it[Accounts.type],
                    initial_balance = it[Accounts.initialBalance],
                    currency = it[Accounts.currency],
                    sort_order = it[Accounts.sortOrder],
                    payment_day = it[Accounts.paymentDay],
                    balance = balance,
                    version = it[Accounts.version],
                    created_at = it[Accounts.createdAt].toString(),
                    updated_at = it[Accounts.updatedAt].toString(),
                    deleted_at = it[Accounts.deletedAt]?.toString()
                )
            },
            icon = this[SavingsGoals.icon],
            color = this[SavingsGoals.color],
            sort_order = this[SavingsGoals.sortOrder],
            status = this[SavingsGoals.status],
            progress_rate = Math.round(progressRate * 100.0) / 100.0,
            remaining_amount = remaining,
            monthly_recommended = monthlyRecommended,
            achieved_at = this[SavingsGoals.achievedAt]?.toString(),
            version = this[SavingsGoals.version],
            created_at = this[SavingsGoals.createdAt].toString(),
            updated_at = this[SavingsGoals.updatedAt].toString(),
            deleted_at = this[SavingsGoals.deletedAt]?.toString()
        )
    }

    private fun ResultRow.toSummary(balanceMap: Map<UUID, Long>): SavingsGoalSummary {
        val target = this[SavingsGoals.targetAmount]
        val accId = this[SavingsGoals.accountId]
        val current = if (accId != null && balanceMap.containsKey(accId)) {
            balanceMap[accId]!!
        } else {
            this[SavingsGoals.currentAmount]
        }
        val remaining = maxOf(target - current, 0)
        val progressRate = if (target > 0) (current.toDouble() / target.toDouble()) * 100.0 else 0.0
        val deadlineVal = this[SavingsGoals.deadline]

        return SavingsGoalSummary(
            id = this[SavingsGoals.id].toString(),
            name = this[SavingsGoals.name],
            target_amount = target,
            current_amount = current,
            progress_rate = Math.round(progressRate * 100.0) / 100.0,
            icon = this[SavingsGoals.icon],
            color = this[SavingsGoals.color],
            deadline = deadlineVal?.toString(),
            monthly_recommended = calculateMonthlyRecommended(remaining, deadlineVal)
        )
    }

    private fun calculateMonthlyRecommended(remaining: Long, deadline: LocalDate?): Long? {
        if (deadline == null || remaining <= 0) return null
        val today = LocalDate.now()
        if (!deadline.isAfter(today)) return null
        val monthsLeft = ChronoUnit.MONTHS.between(YearMonth.from(today), YearMonth.from(deadline))
        if (monthsLeft <= 0) return remaining
        return (remaining + monthsLeft - 1) / monthsLeft // ceiling division
    }

    private fun validateRequest(request: SavingsGoalRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.name.isBlank() || request.name.length > 100)
            errors.add(FieldError("name", "目標名は1〜100文字で入力してください"))
        if (request.target_amount < 1)
            errors.add(FieldError("target_amount", "目標額は1以上の値を指定してください"))
        if (request.target_amount > ValidationRules.AMOUNT_MAX)
            errors.add(FieldError("target_amount", "目標額が上限を超えています"))
        val deadline = request.deadline
        if (deadline != null) {
            try { LocalDate.parse(deadline) }
            catch (_: Exception) { errors.add(FieldError("deadline", "期限の形式が不正です（YYYY-MM-DD）")) }
        }
        val color = request.color
        if (color != null && color.isNotBlank() && !ValidationRules.validateColor(color))
            errors.add(FieldError("color", "色は#RRGGBB形式で指定してください"))
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
