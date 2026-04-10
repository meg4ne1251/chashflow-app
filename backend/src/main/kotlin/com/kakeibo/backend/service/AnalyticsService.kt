package com.kakeibo.backend.service

import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.backend.repository.BudgetRepository
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.backend.db.Budgets
import com.kakeibo.backend.db.Categories
import com.kakeibo.shared.model.FieldError
import com.kakeibo.shared.model.*
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeParseException
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.round

class AnalyticsService(
    private val transactionRepository: TransactionRepository,
    private val budgetRepository: BudgetRepository,
    private val categoryRepository: CategoryRepository,
    private val accountService: AccountService,
    private val savingsGoalService: SavingsGoalService? = null
) {
    private companion object {
        private const val CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutes
        private const val MAX_CACHE_SIZE = 200
    }

    /** Holds aggregated income and expense totals for a category within a period. */
    private data class CategoryTotals(val name: String, val income: Long, val expense: Long)

    // In-memory cache with TTL and bounded size
    private data class CacheEntry<T>(val data: T, val expireAt: Long)
    private val cache = ConcurrentHashMap<String, CacheEntry<*>>()

    /**
     * "YYYY-MM" 形式の文字列を検証して YearMonth に変換する。
     * 不正な形式の場合は 400 ValidationException を投げる (500 にしない)。
     */
    private fun parseYearMonthOrThrow(yearMonth: String, fieldName: String = "year_month"): YearMonth {
        return try {
            YearMonth.parse(yearMonth)
        } catch (e: DateTimeParseException) {
            throw ValidationException(
                "${fieldName}の形式が不正です (YYYY-MM 形式で指定してください)",
                listOf(FieldError(fieldName, "YYYY-MM 形式で指定してください"))
            )
        }
    }

    fun invalidateCache(yearMonth: String) {
        // yearMonthを含むキーを正確に無効化する
        // "2024-01" が "2024-01-2025" などに誤マッチしないよう、
        // キーの区切り文字を考慮してマッチングする
        cache.keys.removeIf { key ->
            // "dashboard:2024-01", "breakdown:2024-01:expense", "comparison:2024-01",
            // "yearly:2024" (年単位キーはyearMonthの年部分で無効化)
            val segments = key.split(":")
            segments.any { it == yearMonth } || segments.any { it == yearMonth.substringBefore("-") }
        }
    }

    fun invalidateAllCache() {
        cache.clear()
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> cached(key: String, compute: () -> T): T {
        val now = System.currentTimeMillis()

        // Check existing valid entry first (fast path)
        val existing = cache[key]
        if (existing != null && existing.expireAt > now) {
            return existing.data as T
        }

        // Evict expired entries and enforce size limit before computing
        if (cache.size > MAX_CACHE_SIZE) {
            cache.entries.removeIf { it.value.expireAt <= now }
            if (cache.size > MAX_CACHE_SIZE) {
                cache.entries
                    .sortedBy { it.value.expireAt }
                    .take(cache.size - MAX_CACHE_SIZE + 1)
                    .forEach { cache.remove(it.key) }
            }
        }

        // Compute and store atomically using compute to avoid duplicate computation
        val entry = cache.compute(key) { _, current ->
            val currentNow = System.currentTimeMillis()
            if (current != null && current.expireAt > currentNow) {
                current // Another thread already computed it
            } else {
                CacheEntry(compute(), currentNow + CACHE_TTL_MS)
            }
        }!!
        return entry.data as T
    }

    fun getDashboard(): DashboardResponse {
        val now = LocalDate.now()
        val yearMonth = String.format("%04d-%02d", now.year, now.monthValue)

        return cached("dashboard:$yearMonth") {
            val (income, expense) = transactionRepository.getMonthlySummary(now.year, now.monthValue)

            // Batch-load all category expense sums for the month (eliminates N+1)
            val spentByCategory = transactionRepository.sumAllCategoriesByMonth(yearMonth)

            // Batch-load all category names
            val allCategories = categoryRepository.findAll()
            val categoryNameMap = allCategories.associate { it[Categories.id] to it[Categories.name] }

            // Budget consumption (top 3)
            val budgets = budgetRepository.findByYearMonth(yearMonth)
            val budgetConsumptions = budgets
                .map { row ->
                    val catId = row[Budgets.categoryId]
                    val budgetAmount = row[Budgets.amount]
                    val spent = spentByCategory[catId] ?: 0L
                    val rate = if (budgetAmount > 0) (spent.toDouble() / budgetAmount.toDouble()) * 100.0 else 0.0
                    val catName = categoryNameMap[catId] ?: "不明"
                    BudgetConsumption(
                        category_id = catId.toString(),
                        category_name = catName,
                        budget_amount = budgetAmount,
                        spent_amount = spent,
                        consumption_rate = round(rate * 100.0) / 100.0
                    )
                }
                .sortedByDescending { it.consumption_rate }
                .take(3)

            // Month-over-month comparison
            val prevMonth = now.minusMonths(1)
            val (prevIncome, prevExpense) = transactionRepository.getMonthlySummary(prevMonth.year, prevMonth.monthValue)
            val incomeChange = income - prevIncome
            val expenseChange = expense - prevExpense
            val incomeChangeRate = if (prevIncome > 0) (incomeChange.toDouble() / prevIncome.toDouble()) * 100.0 else null
            val expenseChangeRate = if (prevExpense > 0) (expenseChange.toDouble() / prevExpense.toDouble()) * 100.0 else null

            // Recent transactions (with category enrichment for frontend display)
            val recentRows = transactionRepository.findRecentTransactions(5)
            val recentTxs = recentRows.map { row ->
                val catId = row[com.kakeibo.backend.db.Transactions.categoryId]
                val catRow = allCategories.find { it[Categories.id] == catId }
                val category = catRow?.let {
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
                }
                TransactionResponse(
                    id = row[com.kakeibo.backend.db.Transactions.id].toString(),
                    type = row[com.kakeibo.backend.db.Transactions.type],
                    amount = row[com.kakeibo.backend.db.Transactions.amount],
                    currency = row[com.kakeibo.backend.db.Transactions.currency],
                    date = row[com.kakeibo.backend.db.Transactions.date].toString(),
                    memo = row[com.kakeibo.backend.db.Transactions.memo],
                    category_id = row[com.kakeibo.backend.db.Transactions.categoryId].toString(),
                    account_id = row[com.kakeibo.backend.db.Transactions.accountId]?.toString(),
                    category = category,
                    is_auto_generated = row[com.kakeibo.backend.db.Transactions.isAutoGenerated],
                    is_balance_adjustment = row[com.kakeibo.backend.db.Transactions.isBalanceAdjustment],
                    recurring_transaction_id = row[com.kakeibo.backend.db.Transactions.recurringTransactionId]?.toString(),
                    version = row[com.kakeibo.backend.db.Transactions.version],
                    created_at = row[com.kakeibo.backend.db.Transactions.createdAt].toString(),
                    updated_at = row[com.kakeibo.backend.db.Transactions.updatedAt].toString(),
                    deleted_at = row[com.kakeibo.backend.db.Transactions.deletedAt]?.toString()
                )
            }

            // Account balances
            val accountBalances = accountService.getAll()

            // Active savings goals
            val savingsGoals = savingsGoalService?.getActiveSummaries() ?: emptyList()

            DashboardResponse(
                income_total = income,
                expense_total = expense,
                balance = income - expense,
                budget_consumption = budgetConsumptions,
                month_over_month = MonthComparison(
                    income_change = incomeChange,
                    expense_change = expenseChange,
                    income_change_rate = incomeChangeRate,
                    expense_change_rate = expenseChangeRate
                ),
                recent_transactions = recentTxs,
                account_balances = accountBalances,
                savings_goals = savingsGoals
            )
        }
    }

    fun getCategoryBreakdown(yearMonth: String, type: String?): CategoryBreakdownResponse {
        val ym = parseYearMonthOrThrow(yearMonth)
        return cached("breakdown:$yearMonth:${type ?: "expense"}") {
            val year = ym.year
            val month = ym.monthValue
            val targetType = type ?: "expense"

            // Batch-load category colors to eliminate N+1 findById calls
            val allCategories = categoryRepository.findAll()
            val categoryColorMap = allCategories.associate { it[Categories.id] to it[Categories.color] }

            val breakdown = transactionRepository.getCategoryBreakdown(year, month, targetType)
            val total = breakdown.sumOf { it.third }

            CategoryBreakdownResponse(
                year_month = yearMonth,
                type = targetType,
                total = total,
                breakdown = breakdown.map { (catId, catName, amount) ->
                    CategoryBreakdownItem(
                        category_id = catId.toString(),
                        category_name = catName,
                        category_color = categoryColorMap[catId],
                        amount = amount,
                        percentage = if (total > 0) round(amount.toDouble() / total.toDouble() * 10000.0) / 100.0 else 0.0
                    )
                }
            )
        }
    }

    fun getTrends(from: String, to: String): TrendResponse {
        val fromYm = parseYearMonthOrThrow(from, "from")
        val toYm = parseYearMonthOrThrow(to, "to")
        if (fromYm.isAfter(toYm)) {
            throw ValidationException(
                "fromはtoより前の年月を指定してください",
                listOf(FieldError("from", "fromはtoより前を指定してください"))
            )
        }
        return cached("trends:$from:$to") {

            // Single batch query instead of N months × 2 types
            val allData = transactionRepository.getCategoryBreakdownRange(
                fromYm.year, fromYm.monthValue, toYm.year, toYm.monthValue
            )

            // Group by yearMonth, then build CategoryTotals per category
            val dataByMonth = allData.groupBy { it.yearMonth }

            val trendItems = mutableListOf<TrendItem>()
            var current = fromYm
            while (!current.isAfter(toYm)) {
                val yearMonth = current.toString()
                val monthData = dataByMonth[yearMonth] ?: emptyList()

                val categoryMap = mutableMapOf<String, CategoryTotals>()
                monthData.forEach { item ->
                    val id = item.categoryId.toString()
                    val existing = categoryMap[id]
                    categoryMap[id] = when (item.type) {
                        "income" -> CategoryTotals(item.categoryName, item.amount, existing?.expense ?: 0L)
                        "expense" -> CategoryTotals(item.categoryName, existing?.income ?: 0L, item.amount)
                        else -> existing ?: CategoryTotals(item.categoryName, 0L, 0L)
                    }
                }

                trendItems.add(TrendItem(
                    year_month = yearMonth,
                    categories = categoryMap.map { (id, totals) ->
                        CategoryTrendItem(
                            category_id = id,
                            category_name = totals.name,
                            income = totals.income,
                            expense = totals.expense
                        )
                    }
                ))

                current = current.plusMonths(1)
            }

            TrendResponse(from = from, to = to, trends = trendItems)
        }
    }

    fun getComparison(yearMonth: String): ComparisonResponse {
        val ym = parseYearMonthOrThrow(yearMonth)
        return cached("comparison:$yearMonth") {
            val prevMonthYm = ym.minusMonths(1)
            val prevYearYm = ym.minusYears(1)

            val current = getPeriodSummary(ym)
            val prevMonth = getPeriodSummary(prevMonthYm)
            val prevYear = getPeriodSummary(prevYearYm)

            ComparisonResponse(
                year_month = yearMonth,
                current = current,
                previous_month = prevMonth,
                previous_year = prevYear,
                mom_change = calculateChange(current, prevMonth),
                yoy_change = calculateChange(current, prevYear)
            )
        }
    }

    fun getYearlySummary(year: Int): YearlySummaryResponse {
        return cached("yearly:$year") {
            // Single batch query for all 12 months instead of 12 separate queries
            val monthlySummaries = transactionRepository.getYearlyMonthlySummary(year)

            var totalIncome = 0L
            var totalExpense = 0L
            val monthly = (1..12).map { month ->
                val (income, expense) = monthlySummaries[month] ?: Pair(0L, 0L)
                totalIncome += income
                totalExpense += expense
                MonthlySummaryItem(
                    year_month = String.format("%04d-%02d", year, month),
                    income = income,
                    expense = expense,
                    balance = income - expense
                )
            }

            // Category summary: single batch query instead of N categories × 12 months
            val yearlySpentByCategory = transactionRepository.sumAllCategoriesByYear(year)
            val allCategories = categoryRepository.findAll()
            val categoryNameMap = allCategories.associate { it[Categories.id] to it[Categories.name] }

            val categorySummary = yearlySpentByCategory
                .filter { (_, total) -> total > 0 }
                .map { (catId, total) ->
                    CategorySummaryItem(
                        category_id = catId.toString(),
                        category_name = categoryNameMap[catId] ?: "不明",
                        amount = total
                    )
                }

            YearlySummaryResponse(
                year = year,
                total_income = totalIncome,
                total_expense = totalExpense,
                total_savings = totalIncome - totalExpense,
                monthly = monthly,
                category_summary = categorySummary.sortedByDescending { it.amount }
            )
        }
    }

    private fun getPeriodSummary(ym: YearMonth): PeriodSummary {
        val (income, expense) = transactionRepository.getMonthlySummary(ym.year, ym.monthValue)
        val expenseBreakdown = transactionRepository.getCategoryBreakdown(ym.year, ym.monthValue, "expense")
        return PeriodSummary(
            income = income,
            expense = expense,
            balance = income - expense,
            categories = expenseBreakdown.map { (id, name, amount) ->
                CategorySummaryItem(
                    category_id = id.toString(),
                    category_name = name,
                    amount = amount
                )
            }
        )
    }

    private fun calculateChange(current: PeriodSummary, previous: PeriodSummary): ComparisonChange {
        val incomeChange = current.income - previous.income
        val expenseChange = current.expense - previous.expense
        val incomeChangeRate = if (previous.income > 0) (incomeChange.toDouble() / previous.income.toDouble()) * 100.0 else null
        val expenseChangeRate = if (previous.expense > 0) (expenseChange.toDouble() / previous.expense.toDouble()) * 100.0 else null

        val categoryChanges = mutableListOf<CategoryChangeItem>()
        val allCatIds = (current.categories.map { it.category_id } + previous.categories.map { it.category_id }).distinct()
        for (catId in allCatIds) {
            val cur = current.categories.find { it.category_id == catId }
            val prev = previous.categories.find { it.category_id == catId }
            val curAmount = cur?.amount ?: 0L
            val prevAmount = prev?.amount ?: 0L
            val changeAmount = curAmount - prevAmount
            val changeRate = if (prevAmount > 0) (changeAmount.toDouble() / prevAmount.toDouble()) * 100.0 else null
            categoryChanges.add(CategoryChangeItem(
                category_id = catId,
                category_name = cur?.category_name ?: prev?.category_name ?: "",
                current_amount = curAmount,
                previous_amount = prevAmount,
                change_amount = changeAmount,
                change_rate = changeRate
            ))
        }

        return ComparisonChange(
            income_change = incomeChange,
            expense_change = expenseChange,
            income_change_rate = incomeChangeRate,
            expense_change_rate = expenseChangeRate,
            category_changes = categoryChanges
        )
    }
}
