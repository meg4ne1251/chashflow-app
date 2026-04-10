package com.kakeibo.backend.service

import com.kakeibo.backend.db.Budgets
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.BudgetRepository
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class BudgetService(
    private val budgetRepository: BudgetRepository,
    private val transactionRepository: TransactionRepository,
    private val categoryRepository: CategoryRepository
) {
    fun getByYearMonth(yearMonth: String): List<BudgetResponse> {
        if (!ValidationRules.validateYearMonth(yearMonth))
            throw ValidationException("年月の形式が不正です（YYYY-MM）", listOf(FieldError("year_month", "YYYY-MM形式で指定してください")))

        val budgets = budgetRepository.findByYearMonth(yearMonth)
        val categoryIds = budgets.map { it[Budgets.categoryId] }
        val categoryMap = categoryRepository.findByIds(categoryIds).associateBy { it[Categories.id] }
        val spentMap = transactionRepository.sumAllCategoriesByMonth(yearMonth)

        return budgets.map { it.toResponse(yearMonth, categoryMap, spentMap) }
    }

    fun upsert(request: BudgetUpsertRequest): List<BudgetResponse> {
        // Validate all budgets before persisting to fail fast
        request.budgets.forEach { validateBudgetRequest(it) }

        return transaction {
            val rows = request.budgets.map { budget ->
                val id = if (budget.id != null) UUID.fromString(budget.id) else UUID.randomUUID()
                budgetRepository.upsert(
                    id = id,
                    categoryId = UUID.fromString(budget.category_id),
                    yearMonth = budget.year_month,
                    amount = budget.amount,
                    currency = budget.currency
                )
            }
            val categoryIds = rows.map { it[Budgets.categoryId] }
            val categoryMap = categoryRepository.findByIds(categoryIds).associateBy { it[Categories.id] }
            rows.mapIndexed { i, row -> row.toResponse(request.budgets[i].year_month, categoryMap) }
        }
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        budgetRepository.findById(uuid) ?: throw NotFoundException("予算が見つかりません")
        if (!budgetRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
        }
    }

    private fun ResultRow.toResponse(yearMonth: String, categoryMap: Map<UUID, ResultRow>, spentMap: Map<UUID, Long>? = null): BudgetResponse {
        val catId = this[Budgets.categoryId]
        val budgetAmount = this[Budgets.amount]
        val spent = spentMap?.get(catId) ?: transactionRepository.sumByCategoryAndMonth(catId, yearMonth)
        val rate = if (budgetAmount > 0) (spent.toDouble() / budgetAmount.toDouble()) * 100.0 else 0.0
        val catRow = categoryMap[catId]

        return BudgetResponse(
            id = this[Budgets.id].toString(),
            category_id = catId.toString(),
            year_month = this[Budgets.yearMonth],
            amount = budgetAmount,
            currency = this[Budgets.currency],
            spent = spent,
            consumption_rate = Math.round(rate * 100.0) / 100.0,
            category = catRow?.let {
                CategoryResponse(
                    id = it[Categories.id].toString(),
                    name = it[Categories.name],
                    type = it[Categories.type],
                    icon = it[Categories.icon],
                    color = it[Categories.color],
                    sort_order = it[Categories.sortOrder],
                    is_default = it[Categories.isDefault],
                    version = it[Categories.version],
                    created_at = it[Categories.createdAt].toString(),
                    updated_at = it[Categories.updatedAt].toString(),
                    deleted_at = it[Categories.deletedAt]?.toString()
                )
            },
            version = this[Budgets.version],
            created_at = this[Budgets.createdAt].toString(),
            updated_at = this[Budgets.updatedAt].toString(),
            deleted_at = this[Budgets.deletedAt]?.toString()
        )
    }

    private fun validateBudgetRequest(request: BudgetRequest) {
        val errors = mutableListOf<FieldError>()
        if (!ValidationRules.validateUuid(request.category_id))
            errors.add(FieldError("category_id", "カテゴリIDの形式が不正です"))
        if (!ValidationRules.validateYearMonth(request.year_month))
            errors.add(FieldError("year_month", "年月の形式が不正です（YYYY-MM）"))
        ValidationRules.validateAmount(request.amount)?.let {
            errors.add(FieldError("amount", it))
        }
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
