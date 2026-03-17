package com.kakeibo.backend.service

import com.kakeibo.backend.db.*
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import java.io.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.YearMonth
import java.util.*

class ImportExportService(
    private val transactionRepository: TransactionRepository,
    private val transactionTagRepository: TransactionTagRepository,
    private val categoryRepository: CategoryRepository,
    private val accountRepository: AccountRepository,
    private val tagRepository: TagRepository,
    private val templateRepository: TemplateRepository,
    private val templateTagRepository: TemplateTagRepository,
    private val recurringTransactionRepository: RecurringTransactionRepository,
    private val recurringTransactionTagRepository: RecurringTransactionTagRepository,
    private val budgetRepository: BudgetRepository,
    private val transferRepository: TransferRepository,
    private val notificationSettingRepository: NotificationSettingRepository,
    private val inputPatternRepository: InputPatternRepository,
    private val transactionHistoryRepository: TransactionHistoryRepository
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024 // 10MB
        private const val MAX_IMPORT_ROWS = 10000
    }

    /**
     * Preview Excel import (returns parsed rows without persisting)
     */
    fun previewExcelImport(inputStream: InputStream, fileSize: Long = 0): ImportPreviewResponse {
        if (fileSize > MAX_IMPORT_FILE_SIZE) {
            throw InvalidRequestException("ファイルサイズが上限(10MB)を超えています")
        }
        val rows = parseExcel(inputStream)
        if (rows.size > MAX_IMPORT_ROWS) {
            throw InvalidRequestException("行数が上限(${MAX_IMPORT_ROWS}行)を超えています")
        }
        val preview = rows.take(20)
        val errors = rows.flatMapIndexed { idx, row -> validateImportRow(row, idx + 2) }
        val validCount = rows.count { row -> validateImportRow(row).isEmpty() }

        return ImportPreviewResponse(
            total_rows = rows.size,
            valid_rows = validCount,
            error_rows = rows.size - validCount,
            preview = preview.mapIndexed { idx, row ->
                ImportPreviewRow(
                    row_number = idx + 2, // header is row 1
                    date = row["date"],
                    type = row["type"],
                    amount = row["amount"]?.toLongOrNull(),
                    category_name = row["category"],
                    account_name = row["account"],
                    memo = row["memo"],
                    tags = row["tags"]
                )
            },
            errors = errors
        )
    }

    /**
     * Import transactions from Excel
     */
    fun importExcel(inputStream: InputStream, fileSize: Long = 0): ImportResultResponse {
        if (fileSize > MAX_IMPORT_FILE_SIZE) {
            throw InvalidRequestException("ファイルサイズが上限(10MB)を超えています")
        }
        val rows = parseExcel(inputStream)
        if (rows.size > MAX_IMPORT_ROWS) {
            throw InvalidRequestException("行数が上限(${MAX_IMPORT_ROWS}行)を超えています")
        }
        var importedCount = 0
        var skippedCount = 0
        val errors = mutableListOf<ImportError>()

        for ((index, row) in rows.withIndex()) {
            val rowNum = index + 2
            val rowErrors = validateImportRow(row, rowNum)
            if (rowErrors.isNotEmpty()) {
                errors.addAll(rowErrors)
                skippedCount++
                continue
            }

            try {
                transaction {
                    val dateStr = row["date"]!!
                    val type = normalizeType(row["type"]!!)
                    val amount = kotlin.math.abs(row["amount"]!!.toLong())
                    val categoryName = row["category"]!!.trim()
                    val accountName = row["account"]!!.trim()
                    val memo = row["memo"]?.trim()

                    // Find or fallback category
                    val category = categoryRepository.findAll()
                        .firstOrNull { it[Categories.name] == categoryName && it[Categories.type] == type }
                        ?: categoryRepository.findAll()
                            .firstOrNull { it[Categories.name] == categoryName }

                    if (category == null) {
                        errors.add(ImportError(rowNum, "category", "カテゴリ「${categoryName}」が見つかりません"))
                        skippedCount++
                        return@transaction
                    }

                    // Find or fallback account
                    val account = accountRepository.findAll()
                        .firstOrNull { it[Accounts.name] == accountName }

                    if (account == null) {
                        errors.add(ImportError(rowNum, "account", "アカウント「${accountName}」が見つかりません"))
                        skippedCount++
                        return@transaction
                    }

                    transactionRepository.create(
                        id = UUID.randomUUID(),
                        type = type,
                        amount = amount,
                        currency = "JPY",
                        date = LocalDate.parse(dateStr).atStartOfDay(),
                        memo = memo,
                        categoryId = category[Categories.id],
                        accountId = account[Accounts.id]
                    )
                    importedCount++
                }
            } catch (e: Exception) {
                logger.error("Import failed at row $rowNum", e)
                errors.add(ImportError(rowNum, null, "インポートに失敗しました: ${e.message}"))
                skippedCount++
            }
        }

        return ImportResultResponse(
            imported_count = importedCount,
            skipped_count = skippedCount,
            errors = errors
        )
    }

    /**
     * Export transactions to CSV
     */
    fun exportCsv(dateFrom: String?, dateTo: String?): ByteArray {
        val filter = TransactionFilter(
            dateFrom = dateFrom?.let { LocalDate.parse(it).atStartOfDay() },
            dateTo = dateTo?.let { LocalDate.parse(it).atTime(java.time.LocalTime.MAX) }
        )
        val (transactions, _) = transactionRepository.findAll(filter, page = null, size = Int.MAX_VALUE, sortField = "date", sortDirection = "asc")

        // Batch-load all categories, accounts, and tags to avoid N+1 queries
        val allCategories = categoryRepository.findAll().associate { it[Categories.id] to it[Categories.name] }
        val allAccounts = accountRepository.findAll().associate {
            it[Accounts.id] to if (it[Accounts.deletedAt] == null) it[Accounts.name] else ""
        }
        val txIds = transactions.map { it[Transactions.id] }
        val tagIdsByTx = if (txIds.isNotEmpty()) transactionTagRepository.findByTransactionIds(txIds) else emptyMap()
        val allTagIds = tagIdsByTx.values.flatten().distinct()
        val allTags = if (allTagIds.isNotEmpty()) {
            tagRepository.findByIds(allTagIds).associate { it[Tags.id] to it[Tags.name] }
        } else emptyMap()

        val sb = StringBuilder()
        // UTF-8 BOM for Excel compatibility
        sb.append('\uFEFF')
        sb.appendLine("日付,種別,金額,カテゴリ,アカウント,メモ,タグ,作成日時,更新日時")

        for (tx in transactions) {
            val catName = allCategories[tx[Transactions.categoryId]] ?: ""
            val accName = tx[Transactions.accountId]?.let { allAccounts[it] } ?: ""
            val txTagIds = tagIdsByTx[tx[Transactions.id]] ?: emptyList()
            val tagNames = txTagIds.mapNotNull { allTags[it] }.joinToString(",") { sanitizeCsvField(it) }

            val type = if (tx[Transactions.type] == "income") "収入" else "支出"
            val memo = sanitizeCsvField(tx[Transactions.memo] ?: "")
            val createdAt = tx[Transactions.createdAt].toString()
            val updatedAt = tx[Transactions.updatedAt].toString()

            sb.appendLine("${tx[Transactions.date]},$type,${tx[Transactions.amount]},\"${sanitizeCsvField(catName)}\",\"${sanitizeCsvField(accName)}\",\"${memo}\",\"${tagNames}\",\"${createdAt}\",\"${updatedAt}\"")
        }

        return sb.toString().toByteArray(Charsets.UTF_8)
    }

    /**
     * Generate PDF report (stub - iText integration)
     */
    fun generatePdf(type: String, yearMonth: String?, year: Int?): ByteArray {
        // PDF generation using iText
        // For now, return a simple text-based PDF placeholder
        // Full iText implementation would go here
        val content = when (type) {
            "monthly" -> {
                val ym = yearMonth ?: throw ValidationException(
                    "年月が必要です",
                    listOf(FieldError("year_month", "指定してください"))
                )
                generateMonthlyReportContent(ym)
            }
            "yearly" -> {
                val y = year ?: throw ValidationException(
                    "年が必要です",
                    listOf(FieldError("year", "指定してください"))
                )
                generateYearlyReportContent(y)
            }
            else -> throw ValidationException(
                "レポートタイプが不正です",
                listOf(FieldError("type", "monthly または yearly を指定してください"))
            )
        }

        // Return UTF-8 text as a basic report (iText would create proper PDF)
        return content.toByteArray(Charsets.UTF_8)
    }

    /**
     * Create JSON backup of all data
     */
    fun createBackup(): BackupData {
        return transaction {
            val now = OffsetDateTime.now()

            BackupData(
                version = "1.0",
                app_version = "1.0.0",
                created_at = now.toString(),
                schema_version = 1,
                data = BackupDataContent(
                    accounts = exportTable(Accounts, Accounts.columns),
                    categories = exportTable(Categories, Categories.columns),
                    tags = exportTable(Tags, Tags.columns),
                    transactions = exportTable(Transactions, Transactions.columns),
                    transaction_tags = exportTable(TransactionTags, TransactionTags.columns),
                    templates = exportTable(Templates, Templates.columns),
                    template_tags = exportTable(TemplateTags, TemplateTags.columns),
                    recurring_transactions = exportTable(RecurringTransactions, RecurringTransactions.columns),
                    recurring_transaction_tags = exportTable(RecurringTransactionTags, RecurringTransactionTags.columns),
                    budgets = exportTable(Budgets, Budgets.columns),
                    transfers = exportTable(Transfers, Transfers.columns),
                    notification_settings = exportTable(NotificationSettings, NotificationSettings.columns),
                    input_patterns = exportTable(InputPatterns, InputPatterns.columns),
                    transaction_history = exportTable(TransactionHistory, TransactionHistory.columns)
                )
            )
        }
    }

    private fun exportTable(table: Table, columns: List<Column<*>>): List<JsonObject> {
        return table.selectAll().map { row ->
            val entries = mutableMapOf<String, JsonElement>()
            for (col in columns) {
                val value = row.getOrNull(col)
                entries[col.name] = when (value) {
                    null -> JsonNull
                    is Boolean -> JsonPrimitive(value)
                    is Number -> JsonPrimitive(value)
                    else -> JsonPrimitive(value.toString())
                }
            }
            JsonObject(entries)
        }
    }

    /**
     * Restore data from JSON backup (overwrite mode - truncates all tables first)
     */
    fun restoreBackup(backupData: BackupData) {
        transaction {
            // Order matters: delete child tables first to avoid FK violations
            TransactionHistory.deleteAll()
            TransactionTags.deleteAll()
            TemplateTags.deleteAll()
            RecurringTransactionTags.deleteAll()
            Transactions.deleteAll()
            Templates.deleteAll()
            RecurringTransactions.deleteAll()
            Budgets.deleteAll()
            Transfers.deleteAll()
            InputPatterns.deleteAll()
            NotificationSettings.deleteAll()
            Tags.deleteAll()
            Categories.deleteAll()
            Accounts.deleteAll()

            // Restore in dependency order
            restoreTable(Accounts, backupData.data.accounts)
            restoreTable(Categories, backupData.data.categories)
            restoreTable(Tags, backupData.data.tags)
            restoreTable(Transactions, backupData.data.transactions)
            restoreTable(TransactionTags, backupData.data.transaction_tags)
            restoreTable(Templates, backupData.data.templates)
            restoreTable(TemplateTags, backupData.data.template_tags)
            restoreTable(RecurringTransactions, backupData.data.recurring_transactions)
            restoreTable(RecurringTransactionTags, backupData.data.recurring_transaction_tags)
            restoreTable(Budgets, backupData.data.budgets)
            restoreTable(Transfers, backupData.data.transfers)
            restoreTable(NotificationSettings, backupData.data.notification_settings)
            restoreTable(InputPatterns, backupData.data.input_patterns)
            restoreTable(TransactionHistory, backupData.data.transaction_history)
        }
        logger.info("バックアップからの復元が完了しました")
    }

    @Suppress("UNCHECKED_CAST")
    private fun restoreTable(table: Table, rows: List<JsonObject>) {
        for (row in rows) {
            table.insert { stmt ->
                for (col in table.columns) {
                    val value = row[col.name]
                    if (value != null && value !is JsonNull) {
                        val strValue = value.jsonPrimitive.contentOrNull ?: continue
                        try {
                            when {
                                col.columnType.sqlType().contains("UUID", ignoreCase = true) ->
                                    stmt[col as Column<UUID>] = UUID.fromString(strValue)
                                col.columnType.sqlType().contains("BOOL", ignoreCase = true) ->
                                    stmt[col as Column<Boolean>] = strValue.toBoolean()
                                col.columnType.sqlType().contains("BIGINT", ignoreCase = true) ||
                                col.columnType.sqlType().contains("INT8", ignoreCase = true) ->
                                    stmt[col as Column<Long>] = strValue.toLong()
                                col.columnType.sqlType().contains("INT", ignoreCase = true) ->
                                    stmt[col as Column<Int>] = strValue.toInt()
                                col.columnType.sqlType().contains("WITH TIME ZONE", ignoreCase = true) ->
                                    stmt[col as Column<OffsetDateTime>] = OffsetDateTime.parse(strValue)
                                col.columnType.sqlType().contains("TIMESTAMP", ignoreCase = true) ->
                                    stmt[col as Column<LocalDateTime>] = LocalDateTime.parse(strValue)
                                col.columnType.sqlType().contains("DATE", ignoreCase = true) ->
                                    stmt[col as Column<LocalDate>] = LocalDate.parse(strValue)
                                else ->
                                    stmt[col as Column<String>] = strValue
                            }
                        } catch (e: Exception) {
                            logger.warn("復元時にカラム ${col.name} の変換に失敗: $strValue", e)
                        }
                    }
                }
            }
        }
    }

    // ===== Private Helpers =====

    private fun parseExcel(inputStream: InputStream): List<Map<String, String?>> {
        try {
            val workbook = org.apache.poi.xssf.usermodel.XSSFWorkbook(inputStream)
            val sheet = workbook.getSheetAt(0)
            val rows = mutableListOf<Map<String, String?>>()

            // Expected columns: 日付, 種別, 金額, カテゴリ, アカウント, メモ, タグ
            val headerRow = sheet.getRow(0) ?: return emptyList()
            val headers = (0 until headerRow.lastCellNum).map { idx ->
                headerRow.getCell(idx)?.stringCellValue?.trim() ?: ""
            }

            val colMap = mapOf(
                "日付" to "date", "date" to "date",
                "種別" to "type", "type" to "type",
                "金額" to "amount", "amount" to "amount",
                "カテゴリ" to "category", "category" to "category",
                "アカウント" to "account", "account" to "account",
                "メモ" to "memo", "memo" to "memo",
                "タグ" to "tags", "tags" to "tags"
            )

            for (rowNum in 1..sheet.lastRowNum) {
                val row = sheet.getRow(rowNum) ?: continue
                val data = mutableMapOf<String, String?>()
                for ((idx, header) in headers.withIndex()) {
                    val key = colMap[header.lowercase()] ?: continue
                    val cell = row.getCell(idx)
                    data[key] = when (cell?.cellType) {
                        org.apache.poi.ss.usermodel.CellType.NUMERIC -> {
                            if (org.apache.poi.ss.usermodel.DateUtil.isCellDateFormatted(cell)) {
                                cell.localDateTimeCellValue.toLocalDate().toString()
                            } else {
                                cell.numericCellValue.toLong().toString()
                            }
                        }
                        org.apache.poi.ss.usermodel.CellType.STRING -> cell.stringCellValue?.trim()
                        else -> null
                    }
                }
                if (data.isNotEmpty() && data.values.any { it != null }) {
                    rows.add(data)
                }
            }
            workbook.close()
            return rows
        } catch (e: Exception) {
            logger.error("Excel parse error", e)
            throw InvalidRequestException("Excelファイルの読み込みに失敗しました: ${e.message}")
        }
    }

    private fun validateImportRow(row: Map<String, String?>, rowNum: Int = 0): List<ImportError> {
        val errors = mutableListOf<ImportError>()

        if (row["date"].isNullOrBlank()) errors.add(ImportError(rowNum, "date", "日付は必須です"))
        if (row["type"].isNullOrBlank()) errors.add(ImportError(rowNum, "type", "種別は必須です"))
        if (row["amount"].isNullOrBlank()) errors.add(ImportError(rowNum, "amount", "金額は必須です"))
        else {
            val amount = row["amount"]!!.toLongOrNull()
            if (amount == null) errors.add(ImportError(rowNum, "amount", "金額は整数で入力してください"))
        }
        if (row["category"].isNullOrBlank()) errors.add(ImportError(rowNum, "category", "カテゴリは必須です"))
        if (row["account"].isNullOrBlank()) errors.add(ImportError(rowNum, "account", "アカウントは必須です"))

        return errors
    }

    /**
     * Sanitize a CSV field to prevent CSV injection.
     * Prefixes with a single quote if the value starts with characters
     * that could be interpreted as formulas by spreadsheet applications.
     */
    private fun sanitizeCsvField(value: String): String {
        val sanitized = value.replace("\"", "\"\"").replace("\n", " ").replace("\r", " ")
        return if (sanitized.isNotEmpty() && sanitized[0] in listOf('=', '+', '-', '@', '\t', '\r')) {
            "'$sanitized"
        } else {
            sanitized
        }
    }

    private fun normalizeType(type: String): String {
        return when (type.trim().lowercase()) {
            "income", "収入" -> "income"
            "expense", "支出" -> "expense"
            else -> type.trim().lowercase()
        }
    }

    private fun generateMonthlyReportContent(yearMonth: String): String {
        val parts = yearMonth.split("-")
        val year = parts[0].toInt()
        val month = parts[1].toInt()
        val (income, expense) = transactionRepository.getMonthlySummary(year, month)
        val breakdown = transactionRepository.getCategoryBreakdown(year, month, "expense")

        val sb = StringBuilder()
        sb.appendLine("月次レポート: ${yearMonth}")
        sb.appendLine("=" .repeat(40))
        sb.appendLine("収入合計: ¥${String.format("%,d", income)}")
        sb.appendLine("支出合計: ¥${String.format("%,d", expense)}")
        sb.appendLine("収支: ¥${String.format("%,d", income - expense)}")
        sb.appendLine()
        sb.appendLine("カテゴリ別支出:")
        for ((_, name, amount) in breakdown) {
            sb.appendLine("  $name: ¥${String.format("%,d", amount)}")
        }
        return sb.toString()
    }

    private fun generateYearlyReportContent(year: Int): String {
        val sb = StringBuilder()
        sb.appendLine("年間レポート: ${year}年")
        sb.appendLine("=".repeat(40))

        var totalIncome = 0L
        var totalExpense = 0L
        for (month in 1..12) {
            val (income, expense) = transactionRepository.getMonthlySummary(year, month)
            totalIncome += income
            totalExpense += expense
            sb.appendLine("${month}月: 収入 ¥${String.format("%,d", income)} / 支出 ¥${String.format("%,d", expense)}")
        }
        sb.appendLine()
        sb.appendLine("年間合計: 収入 ¥${String.format("%,d", totalIncome)} / 支出 ¥${String.format("%,d", totalExpense)}")
        sb.appendLine("年間収支: ¥${String.format("%,d", totalIncome - totalExpense)}")
        return sb.toString()
    }
}
