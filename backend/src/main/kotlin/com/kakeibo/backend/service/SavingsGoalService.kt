package com.kakeibo.backend.service

import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.SavingsGoals
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.AccountRepository
import com.kakeibo.backend.repository.NotificationRepository
import com.kakeibo.backend.repository.NotificationSettingRepository
import com.kakeibo.backend.repository.SavingsGoalRepository
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
    private val notificationRepository: NotificationRepository,
    private val notificationSettingRepository: NotificationSettingRepository
) {
    fun getAll(): List<SavingsGoalResponse> {
        val goals = savingsGoalRepository.findAll()
        val accountIds = goals.mapNotNull { it[SavingsGoals.accountId] }.distinct()
        val accountMap = if (accountIds.isNotEmpty()) {
            accountIds.mapNotNull { accountRepository.findById(it) }
                .associateBy { it[Accounts.id] }
        } else emptyMap()
        return goals.map { it.toResponse(accountMap) }
    }

    fun getById(id: String): SavingsGoalResponse {
        val uuid = UUID.fromString(id)
        val goal = savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")
        val accountMap = goal[SavingsGoals.accountId]?.let { accId ->
            accountRepository.findById(accId)?.let { mapOf(accId to it) }
        } ?: emptyMap()
        return goal.toResponse(accountMap)
    }

    fun getActiveSummaries(): List<SavingsGoalSummary> {
        return savingsGoalRepository.findActive().map { it.toSummary() }
    }

    fun create(request: SavingsGoalRequest): SavingsGoalResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()
        val row = savingsGoalRepository.create(
            id = id,
            name = request.name,
            targetAmount = request.target_amount,
            currentAmount = request.current_amount,
            currency = request.currency,
            deadline = request.deadline?.let { LocalDate.parse(it) },
            accountId = request.account_id?.let { UUID.fromString(it) },
            icon = request.icon,
            color = request.color,
            sortOrder = request.sort_order
        )
        return row.toResponse(emptyMap())
    }

    fun update(id: String, request: SavingsGoalRequest): SavingsGoalResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)
        val version = request.version ?: throw ValidationException(
            "バージョンを指定してください",
            listOf(FieldError("version", "version は必須です"))
        )
        savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")

        val row = savingsGoalRepository.update(
            id = uuid,
            name = request.name,
            targetAmount = request.target_amount,
            currentAmount = request.current_amount,
            currency = request.currency,
            deadline = request.deadline?.let { LocalDate.parse(it) },
            accountId = request.account_id?.let { UUID.fromString(it) },
            icon = request.icon,
            color = request.color,
            sortOrder = request.sort_order,
            currentVersion = version
        ) ?: throw ConflictException("バージョン競合が発生しました")

        checkAndNotifyAchievement(row)
        return row.toResponse(emptyMap())
    }

    fun updateAmount(id: String, amount: Long, version: Int): SavingsGoalResponse {
        val uuid = UUID.fromString(id)
        savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")

        if (amount < 0) throw ValidationException(
            "金額が不正です",
            listOf(FieldError("current_amount", "現在の積立額は0以上にしてください"))
        )

        val row = savingsGoalRepository.updateCurrentAmount(uuid, amount, version)
            ?: throw ConflictException("バージョン競合が発生しました")

        checkAndNotifyAchievement(row)
        return row.toResponse(emptyMap())
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        savingsGoalRepository.findActiveById(uuid)
            ?: throw NotFoundException("貯蓄目標が見つかりません")
        if (!savingsGoalRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
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

    private fun ResultRow.toResponse(accountMap: Map<UUID, ResultRow>): SavingsGoalResponse {
        val target = this[SavingsGoals.targetAmount]
        val current = this[SavingsGoals.currentAmount]
        val remaining = maxOf(target - current, 0)
        val progressRate = if (target > 0) (current.toDouble() / target.toDouble()) * 100.0 else 0.0
        val deadlineVal = this[SavingsGoals.deadline]
        val monthlyRecommended = calculateMonthlyRecommended(remaining, deadlineVal)
        val accId = this[SavingsGoals.accountId]
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
                AccountResponse(
                    id = it[Accounts.id].toString(),
                    name = it[Accounts.name],
                    type = it[Accounts.type],
                    initial_balance = it[Accounts.initialBalance],
                    currency = it[Accounts.currency],
                    sort_order = it[Accounts.sortOrder],
                    payment_day = it[Accounts.paymentDay],
                    balance = 0,
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

    private fun ResultRow.toSummary(): SavingsGoalSummary {
        val target = this[SavingsGoals.targetAmount]
        val current = this[SavingsGoals.currentAmount]
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
        if (request.current_amount < 0)
            errors.add(FieldError("current_amount", "現在の積立額は0以上にしてください"))
        val accountId = request.account_id
        if (accountId != null && !ValidationRules.validateUuid(accountId))
            errors.add(FieldError("account_id", "決済手段IDの形式が不正です"))
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
