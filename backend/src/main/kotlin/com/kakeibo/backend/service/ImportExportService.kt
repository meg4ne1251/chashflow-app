package com.kakeibo.backend.service

import com.kakeibo.backend.db.*
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.statements.UpdateBuilder
import org.jetbrains.exposed.sql.transactions.transaction
import com.itextpdf.kernel.colors.ColorConstants
import com.itextpdf.kernel.font.PdfFont
import com.itextpdf.kernel.font.PdfFontFactory
import com.itextpdf.kernel.pdf.PdfDocument
import com.itextpdf.kernel.pdf.PdfWriter
import com.itextpdf.layout.Document
import com.itextpdf.layout.element.Cell
import com.itextpdf.layout.element.Paragraph
import com.itextpdf.layout.element.Table as PdfTable
import com.itextpdf.layout.properties.TextAlignment
import com.itextpdf.layout.properties.UnitValue
import com.itextpdf.kernel.colors.DeviceRgb
import com.itextpdf.kernel.pdf.canvas.PdfCanvas
import org.slf4j.LoggerFactory
import java.io.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
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
        private val MAX_IMPORT_FILE_SIZE = ValidationRules.MAX_IMPORT_FILE_SIZE
        private val MAX_IMPORT_ROWS = ValidationRules.MAX_IMPORT_ROWS

        private val COLOR_TITLE = DeviceRgb(26, 35, 126)
        private val COLOR_SECTION = DeviceRgb(21, 101, 192)
        private val COLOR_HEADER_BG = DeviceRgb(33, 150, 243)
        private val COLOR_INCOME = DeviceRgb(46, 125, 50)
        private val COLOR_EXPENSE = DeviceRgb(198, 40, 40)
        private val COLOR_POSITIVE = DeviceRgb(46, 125, 50)
        private val COLOR_NEGATIVE = DeviceRgb(198, 40, 40)
        private val COLOR_BUDGET_OK = DeviceRgb(46, 125, 50)
        private val COLOR_BUDGET_WARN = DeviceRgb(255, 152, 0)
        private val COLOR_BUDGET_OVER = DeviceRgb(198, 40, 40)

        private val PIE_COLORS = listOf(
            DeviceRgb(66, 133, 244),
            DeviceRgb(234, 67, 53),
            DeviceRgb(251, 188, 4),
            DeviceRgb(52, 168, 83),
            DeviceRgb(255, 109, 0),
            DeviceRgb(171, 71, 188),
            DeviceRgb(0, 172, 193),
            DeviceRgb(124, 179, 66),
            DeviceRgb(236, 64, 122),
            DeviceRgb(63, 81, 181),
            DeviceRgb(121, 85, 72),
            DeviceRgb(158, 158, 158)
        )
    }

    /**
     * Preview CSV import (returns parsed rows without persisting)
     */
    fun previewCsvImport(inputStream: InputStream, fileSize: Long = 0): ImportPreviewResponse {
        if (fileSize > MAX_IMPORT_FILE_SIZE) {
            throw InvalidRequestException("ファイルサイズが上限(10MB)を超えています")
        }
        val rows = parseCsv(inputStream)
        if (rows.size > MAX_IMPORT_ROWS) {
            throw InvalidRequestException("行数が上限(${MAX_IMPORT_ROWS}行)を超えています")
        }
        val preview = rows.take(20)
        val rowErrors = rows.mapIndexed { idx, row -> validateImportRow(row, idx + 2) }
        val errors = rowErrors.flatten()
        val validCount = rowErrors.count { it.isEmpty() }

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
                    name = row["name"],
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
     * Import transactions from CSV
     */
    fun importCsv(inputStream: InputStream, fileSize: Long = 0): ImportResultResponse {
        if (fileSize > MAX_IMPORT_FILE_SIZE) {
            throw InvalidRequestException("ファイルサイズが上限(10MB)を超えています")
        }
        val rows = parseCsv(inputStream)
        if (rows.size > MAX_IMPORT_ROWS) {
            throw InvalidRequestException("行数が上限(${MAX_IMPORT_ROWS}行)を超えています")
        }
        var importedCount = 0
        var skippedCount = 0
        val errors = mutableListOf<ImportError>()

        // Pre-load all categories and accounts (including deleted) to avoid N+1 queries
        val allCategories = categoryRepository.findAll(includeDeleted = true)
        val allAccounts = accountRepository.findAll(includeDeleted = true)

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
                    val dateTime = try {
                        LocalDateTime.parse(dateStr)
                    } catch (_: Exception) {
                        LocalDate.parse(dateStr).atStartOfDay()
                    }
                    val type = normalizeType(row["type"]!!)
                    val amount = kotlin.math.abs(row["amount"]!!.toLong())
                    val categoryName = row["category"]?.trim()
                    val accountName = row["account"]?.trim()
                    val name = row["name"]?.trim()
                    val memo = row["memo"]?.trim()

                    // Find category (null if not specified)
                    val categoryId = if (!categoryName.isNullOrEmpty()) {
                        val category = allCategories
                            .firstOrNull { it[Categories.name] == categoryName && it[Categories.type] == type }
                            ?: allCategories.firstOrNull { it[Categories.name] == categoryName }

                        if (category == null) {
                            errors.add(ImportError(rowNum, "category", "カテゴリ「${categoryName}」が見つかりません"))
                            skippedCount++
                            return@transaction
                        }
                        category[Categories.id]
                    } else null

                    // Find account (null if not specified)
                    val accountId = if (!accountName.isNullOrEmpty()) {
                        val account = allAccounts
                            .firstOrNull { it[Accounts.name] == accountName }

                        if (account == null) {
                            errors.add(ImportError(rowNum, "account", "アカウント「${accountName}」が見つかりません"))
                            skippedCount++
                            return@transaction
                        }
                        account[Accounts.id]
                    } else null

                    transactionRepository.create(
                        id = UUID.randomUUID(),
                        type = type,
                        amount = amount,
                        currency = "JPY",
                        date = dateTime,
                        memo = memo,
                        categoryId = categoryId,
                        accountId = accountId,
                        name = name
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

        // Batch-load all categories, accounts (including deleted) and tags to avoid N+1 queries
        val allCategories = categoryRepository.findAll(includeDeleted = true).associate { it[Categories.id] to it[Categories.name] }
        val allAccounts = accountRepository.findAll(includeDeleted = true).associate { it[Accounts.id] to it[Accounts.name] }
        val txIds = transactions.map { it[Transactions.id] }
        val tagIdsByTx = if (txIds.isNotEmpty()) transactionTagRepository.findByTransactionIds(txIds) else emptyMap()
        val allTagIds = tagIdsByTx.values.flatten().distinct()
        val allTags = if (allTagIds.isNotEmpty()) {
            tagRepository.findByIds(allTagIds).associate { it[Tags.id] to it[Tags.name] }
        } else emptyMap()

        val sb = StringBuilder()
        // UTF-8 BOM for Excel compatibility
        sb.append('\uFEFF')
        sb.appendLine("日付,種別,金額,名前,カテゴリ,アカウント,メモ,タグ,作成日時,更新日時")

        for (tx in transactions) {
            val catName = allCategories[tx[Transactions.categoryId]] ?: ""
            val accName = tx[Transactions.accountId]?.let { allAccounts[it] } ?: ""
            val txTagIds = tagIdsByTx[tx[Transactions.id]] ?: emptyList()
            val tagNames = txTagIds.mapNotNull { allTags[it] }.joinToString(",") { sanitizeCsvField(it) }

            val type = if (tx[Transactions.type] == "income") "収入" else "支出"
            val name = sanitizeCsvField(tx[Transactions.name] ?: "")
            val memo = sanitizeCsvField(tx[Transactions.memo] ?: "")
            val createdAt = tx[Transactions.createdAt].toString()
            val updatedAt = tx[Transactions.updatedAt].toString()

            sb.appendLine("${tx[Transactions.date]},$type,${tx[Transactions.amount]},\"${name}\",\"${sanitizeCsvField(catName)}\",\"${sanitizeCsvField(accName)}\",\"${memo}\",\"${tagNames}\",\"${createdAt}\",\"${updatedAt}\"")
        }

        return sb.toString().toByteArray(Charsets.UTF_8)
    }

    /**
     * Generate PDF report using iText
     */
    fun generatePdf(type: String, yearMonth: String?, year: Int?): ByteArray {
        val baos = ByteArrayOutputStream()
        val writer = PdfWriter(baos)
        val pdfDoc = PdfDocument(writer)
        val document = Document(pdfDoc)
        val font = createJapaneseFont()
        document.setFont(font)
        document.setFontSize(10f)

        when (type) {
            "monthly" -> {
                val ym = yearMonth ?: throw ValidationException(
                    "年月が必要です",
                    listOf(FieldError("year_month", "指定してください"))
                )
                writeMonthlyPdfReport(document, pdfDoc, font, ym)
            }
            "yearly" -> {
                val y = year ?: throw ValidationException(
                    "年が必要です",
                    listOf(FieldError("year", "指定してください"))
                )
                writeYearlyPdfReport(document, pdfDoc, font, y)
            }
            else -> throw ValidationException(
                "レポートタイプが不正です",
                listOf(FieldError("type", "monthly または yearly を指定してください"))
            )
        }

        document.close()
        return baos.toByteArray()
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
                    transaction_history = exportTable(TransactionHistory, TransactionHistory.columns),
                    notifications = exportTable(Notifications, Notifications.columns)
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
     * Restore data from JSON backup
     * @param mode "overwrite" = truncate all tables first, "merge" = upsert (newer wins)
     */
    fun restoreBackup(backupData: BackupData, mode: String = "overwrite"): List<String> {
        if (backupData.schema_version != 1) {
            throw InvalidRequestException(
                "サポートされていないスキーマバージョンです: ${backupData.schema_version}（対応バージョン: 1）"
            )
        }

        val allErrors = mutableListOf<String>()
        val merge = mode == "merge"

        transaction {
            if (!merge) {
                // Overwrite: delete child tables first to avoid FK violations
                Notifications.deleteAll()
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
            }

            // Restore in dependency order
            allErrors += restoreTable(Accounts, backupData.data.accounts, merge)
            allErrors += restoreTable(Categories, backupData.data.categories, merge)
            allErrors += restoreTable(Tags, backupData.data.tags, merge)
            allErrors += restoreTable(Transactions, backupData.data.transactions, merge)
            allErrors += restoreTable(TransactionTags, backupData.data.transaction_tags, merge)
            allErrors += restoreTable(Templates, backupData.data.templates, merge)
            allErrors += restoreTable(TemplateTags, backupData.data.template_tags, merge)
            allErrors += restoreTable(RecurringTransactions, backupData.data.recurring_transactions, merge)
            allErrors += restoreTable(RecurringTransactionTags, backupData.data.recurring_transaction_tags, merge)
            allErrors += restoreTable(Budgets, backupData.data.budgets, merge)
            allErrors += restoreTable(Transfers, backupData.data.transfers, merge)
            allErrors += restoreTable(NotificationSettings, backupData.data.notification_settings, merge)
            allErrors += restoreTable(InputPatterns, backupData.data.input_patterns, merge)
            allErrors += restoreTable(TransactionHistory, backupData.data.transaction_history, merge)
            allErrors += restoreTable(Notifications, backupData.data.notifications, merge)
        }
        if (allErrors.isEmpty()) {
            logger.info("バックアップからの復元が完了しました（モード: $mode）")
        } else {
            logger.warn("バックアップ復元完了（モード: $mode、${allErrors.size}件の変換エラーあり）")
        }
        return allErrors
    }

    @Suppress("UNCHECKED_CAST")
    private fun restoreTable(table: Table, rows: List<JsonObject>, merge: Boolean = false): List<String> {
        val errors = mutableListOf<String>()
        val pkColumns = table.primaryKey?.columns ?: emptyArray()
        val pkColumnNames = pkColumns.map { it.name }.toSet()

        for ((rowIndex, row) in rows.withIndex()) {
            try {
                if (merge && pkColumns.isNotEmpty()) {
                    val pkValues = parsePkValues(pkColumns, row)
                    if (pkValues != null) {
                        val existing = table.selectAll().where {
                            pkValues.fold(Op.TRUE as Op<Boolean>) { acc, (col, value) ->
                                acc and ((col as Column<Any>) eq value)
                            }
                        }.firstOrNull()

                        if (existing != null) {
                            // For tables with updated_at, only update if backup is newer
                            val updatedAtCol = table.columns.find { it.name == "updated_at" }
                            if (updatedAtCol != null) {
                                val backupUpdatedAt = row["updated_at"]?.jsonPrimitive?.contentOrNull
                                val existingUpdatedAt = existing.getOrNull(updatedAtCol)?.toString()
                                if (backupUpdatedAt != null && existingUpdatedAt != null) {
                                    try {
                                        val backupTime = OffsetDateTime.parse(backupUpdatedAt)
                                        val existingTime = OffsetDateTime.parse(existingUpdatedAt)
                                        if (!backupTime.isAfter(existingTime)) continue
                                    } catch (_: Exception) { }
                                }
                            } else {
                                // Join tables without updated_at: already exists, skip
                                continue
                            }
                            // Update existing record (skip PK columns)
                            table.update({
                                pkValues.fold(Op.TRUE as Op<Boolean>) { acc, (col, value) ->
                                    acc and ((col as Column<Any>) eq value)
                                }
                            }) { stmt ->
                                for (col in table.columns) {
                                    if (col.name in pkColumnNames) continue
                                    setColumnValue(stmt, col, row, errors, rowIndex, table.tableName)
                                }
                            }
                            continue
                        }
                    }
                }
                // Insert new record
                table.insert { stmt ->
                    for (col in table.columns) {
                        setColumnValue(stmt, col, row, errors, rowIndex, table.tableName)
                    }
                }
            } catch (e: Exception) {
                val errorMsg = "テーブル ${table.tableName} 行${rowIndex + 1} の復元に失敗"
                logger.warn(errorMsg, e)
                errors.add(errorMsg)
            }
        }
        return errors
    }

    private fun parsePkValues(pkColumns: Array<out Column<*>>, row: JsonObject): List<Pair<Column<*>, Any>>? {
        val result = mutableListOf<Pair<Column<*>, Any>>()
        for (col in pkColumns) {
            val strValue = row[col.name]?.jsonPrimitive?.contentOrNull ?: return null
            val parsed: Any = if (col.columnType.sqlType().contains("UUID", ignoreCase = true)) {
                UUID.fromString(strValue)
            } else {
                strValue
            }
            result.add(col to parsed)
        }
        return result
    }

    @Suppress("UNCHECKED_CAST")
    private fun setColumnValue(
        stmt: UpdateBuilder<*>,
        col: Column<*>,
        row: JsonObject,
        errors: MutableList<String>,
        rowIndex: Int,
        tableName: String
    ) {
        val value = row[col.name]
        if (value != null && value !is JsonNull) {
            val strValue = value.jsonPrimitive.contentOrNull ?: return
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
                    col.columnType.sqlType().contains("TIME", ignoreCase = true) ->
                        stmt[col as Column<LocalTime>] = LocalTime.parse(strValue)
                    col.columnType.sqlType().contains("DATE", ignoreCase = true) ->
                        stmt[col as Column<LocalDate>] = LocalDate.parse(strValue)
                    else ->
                        stmt[col as Column<String>] = strValue
                }
            } catch (e: Exception) {
                val errorMsg = "テーブル $tableName 行${rowIndex + 1} カラム ${col.name} の変換に失敗"
                logger.warn(errorMsg, e)
                errors.add(errorMsg)
            }
        }
    }

    // ===== Private Helpers =====

    private fun parseCsv(inputStream: InputStream): List<Map<String, String?>> {
        try {
            val reader = inputStream.bufferedReader(Charsets.UTF_8)
            var headerLine = reader.readLine() ?: return emptyList()
            // Strip UTF-8 BOM if present
            if (headerLine.startsWith("\uFEFF")) {
                headerLine = headerLine.removePrefix("\uFEFF")
            }
            val headers = parseCsvLine(headerLine).map { it.trim() }

            val colMap = mapOf(
                "日付" to "date", "date" to "date",
                "種別" to "type", "type" to "type",
                "金額" to "amount", "amount" to "amount",
                "名前" to "name", "name" to "name",
                "カテゴリ" to "category", "category" to "category",
                "アカウント" to "account", "account" to "account",
                "メモ" to "memo", "memo" to "memo",
                "タグ" to "tags", "tags" to "tags"
            )

            val rows = mutableListOf<Map<String, String?>>()
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                val values = parseCsvLine(line!!)
                val data = mutableMapOf<String, String?>()
                for ((idx, header) in headers.withIndex()) {
                    val key = colMap[header.lowercase()] ?: continue
                    val value = values.getOrNull(idx)?.trim()
                    data[key] = if (value.isNullOrEmpty()) null else value
                }
                if (data.isNotEmpty() && data.values.any { it != null }) {
                    rows.add(data)
                }
            }
            return rows
        } catch (e: Exception) {
            logger.error("CSV parse error", e)
            throw InvalidRequestException("CSVファイルの読み込みに失敗しました。ファイル形式を確認してください。")
        }
    }

    private fun parseCsvLine(line: String): List<String> {
        val fields = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < line.length) {
            val c = line[i]
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length && line[i + 1] == '"') {
                        sb.append('"')
                        i += 2
                        continue
                    } else {
                        inQuotes = false
                    }
                } else {
                    sb.append(c)
                }
            } else {
                when (c) {
                    ',' -> {
                        fields.add(sb.toString())
                        sb.clear()
                    }
                    '"' -> inQuotes = true
                    else -> sb.append(c)
                }
            }
            i++
        }
        fields.add(sb.toString())
        return fields
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

    private fun writeMonthlyPdfReport(document: Document, pdfDoc: PdfDocument, font: PdfFont, yearMonth: String) {
        val parts = yearMonth.split("-")
        val year = parts[0].toInt()
        val month = parts[1].toInt()
        val (income, expense) = transactionRepository.getMonthlySummary(year, month)
        val expenseBreakdown = transactionRepository.getCategoryBreakdown(year, month, "expense")
        val incomeBreakdown = transactionRepository.getCategoryBreakdown(year, month, "income")

        // Pre-load categories for colors and names
        val allCategories = categoryRepository.findAll()
        val categoryColorMap = allCategories.associate { it[Categories.id] to it[Categories.color] }
        val categoryNameMap = allCategories.associate { it[Categories.id] to it[Categories.name] }

        document.add(
            Paragraph("月次レポート: $yearMonth")
                .setFont(font).setFontSize(18f).setFontColor(COLOR_TITLE)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(20f)
        )

        // === 収支サマリー ===
        val balance = income - expense
        val balanceColor = if (balance >= 0) COLOR_POSITIVE else COLOR_NEGATIVE
        val summaryTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(1f, 1f)))
            .useAllAvailableWidth().setMarginBottom(20f)
        summaryTable.addHeaderCell(pdfCell("項目", font, header = true))
        summaryTable.addHeaderCell(pdfCell("金額", font, header = true))
        summaryTable.addCell(pdfCell("収入合計", font))
        summaryTable.addCell(pdfCell("¥${String.format("%,d", income)}", font, align = TextAlignment.RIGHT, textColor = COLOR_INCOME))
        summaryTable.addCell(pdfCell("支出合計", font))
        summaryTable.addCell(pdfCell("¥${String.format("%,d", expense)}", font, align = TextAlignment.RIGHT, textColor = COLOR_EXPENSE))
        summaryTable.addCell(pdfCell("収支", font))
        summaryTable.addCell(pdfCell("¥${String.format("%,d", balance)}", font, align = TextAlignment.RIGHT, textColor = balanceColor))
        document.add(summaryTable)

        // === 前月比較 ===
        val prevDate = java.time.LocalDate.of(year, month, 1).minusMonths(1)
        val (prevIncome, prevExpense) = transactionRepository.getMonthlySummary(prevDate.year, prevDate.monthValue)
        val prevYearMonth = String.format("%04d-%02d", prevDate.year, prevDate.monthValue)
        document.add(
            Paragraph("前月比較（$prevYearMonth）")
                .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
        )
        val compTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(1f, 1f, 1f, 1f)))
            .useAllAvailableWidth().setMarginBottom(20f)
        compTable.addHeaderCell(pdfCell("項目", font, header = true))
        compTable.addHeaderCell(pdfCell("当月", font, header = true))
        compTable.addHeaderCell(pdfCell("前月", font, header = true))
        compTable.addHeaderCell(pdfCell("増減", font, header = true))

        for ((label, cur, prev) in listOf(
            Triple("収入", income, prevIncome),
            Triple("支出", expense, prevExpense),
            Triple("収支", income - expense, prevIncome - prevExpense)
        )) {
            val diff = cur - prev
            val diffStr = "${if (diff >= 0) "+" else ""}${String.format("%,d", diff)}"
            val diffColor = if (diff >= 0) COLOR_POSITIVE else COLOR_NEGATIVE
            compTable.addCell(pdfCell(label, font))
            compTable.addCell(pdfCell("¥${String.format("%,d", cur)}", font, align = TextAlignment.RIGHT))
            compTable.addCell(pdfCell("¥${String.format("%,d", prev)}", font, align = TextAlignment.RIGHT))
            compTable.addCell(pdfCell("¥$diffStr", font, align = TextAlignment.RIGHT, textColor = diffColor))
        }
        document.add(compTable)

        // === カテゴリ別支出 ===
        if (expenseBreakdown.isNotEmpty()) {
            val expenseTotal = expenseBreakdown.sumOf { it.third }
            document.add(
                Paragraph("カテゴリ別支出")
                    .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
            )
            val breakdownTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(2f, 1f, 1f)))
                .useAllAvailableWidth().setMarginBottom(20f)
            breakdownTable.addHeaderCell(pdfCell("カテゴリ", font, header = true))
            breakdownTable.addHeaderCell(pdfCell("金額", font, header = true))
            breakdownTable.addHeaderCell(pdfCell("割合", font, header = true))
            for ((_, name, amount) in expenseBreakdown) {
                val pct = if (expenseTotal > 0) amount.toDouble() / expenseTotal * 100.0 else 0.0
                breakdownTable.addCell(pdfCell(name, font))
                breakdownTable.addCell(pdfCell("¥${String.format("%,d", amount)}", font, align = TextAlignment.RIGHT, textColor = COLOR_EXPENSE))
                breakdownTable.addCell(pdfCell("${String.format("%.1f", pct)}%", font, align = TextAlignment.RIGHT))
            }
            document.add(breakdownTable)
        }

        // === カテゴリ別収入 ===
        if (incomeBreakdown.isNotEmpty()) {
            val incomeTotal = incomeBreakdown.sumOf { it.third }
            document.add(
                Paragraph("カテゴリ別収入")
                    .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
            )
            val incomeTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(2f, 1f, 1f)))
                .useAllAvailableWidth().setMarginBottom(20f)
            incomeTable.addHeaderCell(pdfCell("カテゴリ", font, header = true))
            incomeTable.addHeaderCell(pdfCell("金額", font, header = true))
            incomeTable.addHeaderCell(pdfCell("割合", font, header = true))
            for ((_, name, amount) in incomeBreakdown) {
                val pct = if (incomeTotal > 0) amount.toDouble() / incomeTotal * 100.0 else 0.0
                incomeTable.addCell(pdfCell(name, font))
                incomeTable.addCell(pdfCell("¥${String.format("%,d", amount)}", font, align = TextAlignment.RIGHT, textColor = COLOR_INCOME))
                incomeTable.addCell(pdfCell("${String.format("%.1f", pct)}%", font, align = TextAlignment.RIGHT))
            }
            document.add(incomeTable)
        }

        // === 予算消化状況 ===
        val budgets = budgetRepository.findByYearMonth(yearMonth)
        if (budgets.isNotEmpty()) {
            val spentByCategory = transactionRepository.sumAllCategoriesByMonth(yearMonth)

            document.add(
                Paragraph("予算消化状況")
                    .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
            )
            val budgetTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(2f, 1f, 1f, 1f, 1f)))
                .useAllAvailableWidth()
            budgetTable.addHeaderCell(pdfCell("カテゴリ", font, header = true))
            budgetTable.addHeaderCell(pdfCell("予算", font, header = true))
            budgetTable.addHeaderCell(pdfCell("実績", font, header = true))
            budgetTable.addHeaderCell(pdfCell("残り", font, header = true))
            budgetTable.addHeaderCell(pdfCell("消化率", font, header = true))

            var totalBudget = 0L
            var totalSpent = 0L
            for (row in budgets) {
                val catId = row[Budgets.categoryId]
                val budgetAmount = row[Budgets.amount]
                val spent = spentByCategory[catId] ?: 0L
                val remaining = budgetAmount - spent
                val rate = if (budgetAmount > 0) spent.toDouble() / budgetAmount * 100.0 else 0.0
                val catName = categoryNameMap[catId] ?: "不明"
                val rateColor = when {
                    rate > 100.0 -> COLOR_BUDGET_OVER
                    rate >= 80.0 -> COLOR_BUDGET_WARN
                    else -> COLOR_BUDGET_OK
                }
                val remainingColor = if (remaining < 0) COLOR_NEGATIVE else null

                totalBudget += budgetAmount
                totalSpent += spent

                budgetTable.addCell(pdfCell(catName, font))
                budgetTable.addCell(pdfCell("¥${String.format("%,d", budgetAmount)}", font, align = TextAlignment.RIGHT))
                budgetTable.addCell(pdfCell("¥${String.format("%,d", spent)}", font, align = TextAlignment.RIGHT))
                budgetTable.addCell(pdfCell("¥${String.format("%,d", remaining)}", font, align = TextAlignment.RIGHT, textColor = remainingColor))
                budgetTable.addCell(pdfCell("${String.format("%.1f", rate)}%", font, align = TextAlignment.RIGHT, textColor = rateColor))
            }

            val totalRemaining = totalBudget - totalSpent
            val totalRate = if (totalBudget > 0) totalSpent.toDouble() / totalBudget * 100.0 else 0.0
            budgetTable.addCell(pdfCell("合計", font, header = true))
            budgetTable.addCell(pdfCell("¥${String.format("%,d", totalBudget)}", font, header = true, align = TextAlignment.RIGHT))
            budgetTable.addCell(pdfCell("¥${String.format("%,d", totalSpent)}", font, header = true, align = TextAlignment.RIGHT))
            budgetTable.addCell(pdfCell("¥${String.format("%,d", totalRemaining)}", font, header = true, align = TextAlignment.RIGHT))
            budgetTable.addCell(pdfCell("${String.format("%.1f", totalRate)}%", font, header = true, align = TextAlignment.RIGHT))
            document.add(budgetTable)
        }

        // === 円グラフページ ===
        if (expenseBreakdown.isNotEmpty()) {
            val expenseTotal = expenseBreakdown.sumOf { it.third }
            val expensePieData = expenseBreakdown.mapIndexed { idx, (catId, name, amount) ->
                val color = hexToDeviceRgb(categoryColorMap[catId]) ?: PIE_COLORS[idx % PIE_COLORS.size]
                Triple(name, amount, color)
            }
            drawPieChartPage(pdfDoc, font, "支出内訳", expensePieData, expenseTotal)
        }
        if (incomeBreakdown.isNotEmpty()) {
            val incomeTotal = incomeBreakdown.sumOf { it.third }
            val incomePieData = incomeBreakdown.mapIndexed { idx, (catId, name, amount) ->
                val color = hexToDeviceRgb(categoryColorMap[catId]) ?: PIE_COLORS[idx % PIE_COLORS.size]
                Triple(name, amount, color)
            }
            drawPieChartPage(pdfDoc, font, "収入内訳", incomePieData, incomeTotal)
        }
    }

    private fun writeYearlyPdfReport(document: Document, pdfDoc: PdfDocument, font: PdfFont, year: Int) {
        // Batch-load monthly summaries and categories
        val monthlySummaries = transactionRepository.getYearlyMonthlySummary(year)
        val allCategories = categoryRepository.findAll()
        val categoryNameMap = allCategories.associate { it[Categories.id] to it[Categories.name] }
        val categoryColorMap = allCategories.associate { it[Categories.id] to it[Categories.color] }

        document.add(
            Paragraph("年間レポート: ${year}年")
                .setFont(font).setFontSize(18f).setFontColor(COLOR_TITLE)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(20f)
        )

        // === 月別収支推移 ===
        document.add(
            Paragraph("月別収支推移")
                .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
        )
        val table = PdfTable(UnitValue.createPercentArray(floatArrayOf(1f, 1f, 1f, 1f)))
            .useAllAvailableWidth().setMarginBottom(20f)
        table.addHeaderCell(pdfCell("月", font, header = true))
        table.addHeaderCell(pdfCell("収入", font, header = true))
        table.addHeaderCell(pdfCell("支出", font, header = true))
        table.addHeaderCell(pdfCell("収支", font, header = true))

        var totalIncome = 0L
        var totalExpense = 0L
        for (month in 1..12) {
            val (income, expense) = monthlySummaries[month] ?: Pair(0L, 0L)
            totalIncome += income
            totalExpense += expense
            val monthBalance = income - expense
            val monthBalColor = if (monthBalance >= 0) COLOR_POSITIVE else COLOR_NEGATIVE
            table.addCell(pdfCell("${month}月", font))
            table.addCell(pdfCell("¥${String.format("%,d", income)}", font, align = TextAlignment.RIGHT, textColor = COLOR_INCOME))
            table.addCell(pdfCell("¥${String.format("%,d", expense)}", font, align = TextAlignment.RIGHT, textColor = COLOR_EXPENSE))
            table.addCell(pdfCell("¥${String.format("%,d", monthBalance)}", font, align = TextAlignment.RIGHT, textColor = monthBalColor))
        }

        table.addCell(pdfCell("合計", font, header = true))
        table.addCell(pdfCell("¥${String.format("%,d", totalIncome)}", font, header = true, align = TextAlignment.RIGHT))
        table.addCell(pdfCell("¥${String.format("%,d", totalExpense)}", font, header = true, align = TextAlignment.RIGHT))
        table.addCell(pdfCell("¥${String.format("%,d", totalIncome - totalExpense)}", font, header = true, align = TextAlignment.RIGHT))
        document.add(table)

        // === カテゴリ別年間支出 ===
        val yearlySpentByCategory = transactionRepository.sumAllCategoriesByYear(year)
        val sortedCategories = yearlySpentByCategory
            .filter { (_, total) -> total > 0 }
            .entries
            .sortedByDescending { it.value }

        if (sortedCategories.isNotEmpty()) {
            val categoryTotal = sortedCategories.sumOf { it.value }

            document.add(
                Paragraph("カテゴリ別年間支出")
                    .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
            )
            val catTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(2f, 1f, 1f)))
                .useAllAvailableWidth().setMarginBottom(20f)
            catTable.addHeaderCell(pdfCell("カテゴリ", font, header = true))
            catTable.addHeaderCell(pdfCell("金額", font, header = true))
            catTable.addHeaderCell(pdfCell("割合", font, header = true))
            for ((catId, amount) in sortedCategories) {
                val catName = categoryNameMap[catId] ?: "不明"
                val pct = if (categoryTotal > 0) amount.toDouble() / categoryTotal * 100.0 else 0.0
                catTable.addCell(pdfCell(catName, font))
                catTable.addCell(pdfCell("¥${String.format("%,d", amount)}", font, align = TextAlignment.RIGHT, textColor = COLOR_EXPENSE))
                catTable.addCell(pdfCell("${String.format("%.1f", pct)}%", font, align = TextAlignment.RIGHT))
            }
            catTable.addCell(pdfCell("合計", font, header = true))
            catTable.addCell(pdfCell("¥${String.format("%,d", categoryTotal)}", font, header = true, align = TextAlignment.RIGHT))
            catTable.addCell(pdfCell("100.0%", font, header = true, align = TextAlignment.RIGHT))
            document.add(catTable)
        }

        // === 年間予算消化状況 ===
        data class BudgetAccum(var totalBudget: Long = 0L, var totalSpent: Long = 0L)
        val budgetByCategory = mutableMapOf<UUID, BudgetAccum>()

        for (month in 1..12) {
            val ym = String.format("%04d-%02d", year, month)
            val budgets = budgetRepository.findByYearMonth(ym)
            if (budgets.isEmpty()) continue
            val spentByCategory = transactionRepository.sumAllCategoriesByMonth(ym)
            for (row in budgets) {
                val catId = row[Budgets.categoryId]
                val budgetAmount = row[Budgets.amount]
                val spent = spentByCategory[catId] ?: 0L
                val accum = budgetByCategory.getOrPut(catId) { BudgetAccum() }
                accum.totalBudget += budgetAmount
                accum.totalSpent += spent
            }
        }

        if (budgetByCategory.isNotEmpty()) {
            document.add(
                Paragraph("年間予算消化状況")
                    .setFont(font).setFontSize(14f).setFontColor(COLOR_SECTION).setMarginBottom(10f)
            )
            val budgetTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(2f, 1f, 1f, 1f, 1f)))
                .useAllAvailableWidth()
            budgetTable.addHeaderCell(pdfCell("カテゴリ", font, header = true))
            budgetTable.addHeaderCell(pdfCell("予算計", font, header = true))
            budgetTable.addHeaderCell(pdfCell("実績計", font, header = true))
            budgetTable.addHeaderCell(pdfCell("残り", font, header = true))
            budgetTable.addHeaderCell(pdfCell("消化率", font, header = true))

            var grandBudget = 0L
            var grandSpent = 0L
            for ((catId, accum) in budgetByCategory.entries.sortedByDescending { it.value.totalSpent }) {
                val catName = categoryNameMap[catId] ?: "不明"
                val remaining = accum.totalBudget - accum.totalSpent
                val rate = if (accum.totalBudget > 0) accum.totalSpent.toDouble() / accum.totalBudget * 100.0 else 0.0
                val rateColor = when {
                    rate > 100.0 -> COLOR_BUDGET_OVER
                    rate >= 80.0 -> COLOR_BUDGET_WARN
                    else -> COLOR_BUDGET_OK
                }
                val remainingColor = if (remaining < 0) COLOR_NEGATIVE else null
                grandBudget += accum.totalBudget
                grandSpent += accum.totalSpent

                budgetTable.addCell(pdfCell(catName, font))
                budgetTable.addCell(pdfCell("¥${String.format("%,d", accum.totalBudget)}", font, align = TextAlignment.RIGHT))
                budgetTable.addCell(pdfCell("¥${String.format("%,d", accum.totalSpent)}", font, align = TextAlignment.RIGHT))
                budgetTable.addCell(pdfCell("¥${String.format("%,d", remaining)}", font, align = TextAlignment.RIGHT, textColor = remainingColor))
                budgetTable.addCell(pdfCell("${String.format("%.1f", rate)}%", font, align = TextAlignment.RIGHT, textColor = rateColor))
            }

            val grandRemaining = grandBudget - grandSpent
            val grandRate = if (grandBudget > 0) grandSpent.toDouble() / grandBudget * 100.0 else 0.0
            budgetTable.addCell(pdfCell("合計", font, header = true))
            budgetTable.addCell(pdfCell("¥${String.format("%,d", grandBudget)}", font, header = true, align = TextAlignment.RIGHT))
            budgetTable.addCell(pdfCell("¥${String.format("%,d", grandSpent)}", font, header = true, align = TextAlignment.RIGHT))
            budgetTable.addCell(pdfCell("¥${String.format("%,d", grandRemaining)}", font, header = true, align = TextAlignment.RIGHT))
            budgetTable.addCell(pdfCell("${String.format("%.1f", grandRate)}%", font, header = true, align = TextAlignment.RIGHT))
            document.add(budgetTable)
        }

        // === 円グラフページ（カテゴリ別年間支出） ===
        if (sortedCategories.isNotEmpty()) {
            val categoryTotal = sortedCategories.sumOf { it.value }
            val pieData = sortedCategories.mapIndexed { idx, (catId, amount) ->
                val catName = categoryNameMap[catId] ?: "不明"
                val color = hexToDeviceRgb(categoryColorMap[catId]) ?: PIE_COLORS[idx % PIE_COLORS.size]
                Triple(catName, amount, color)
            }
            drawPieChartPage(pdfDoc, font, "カテゴリ別年間支出内訳", pieData, categoryTotal)
        }
    }

    private fun hexToDeviceRgb(hex: String?): DeviceRgb? {
        if (hex == null) return null
        return try {
            val clean = hex.removePrefix("#")
            if (clean.length != 6) return null
            DeviceRgb(
                clean.substring(0, 2).toInt(16),
                clean.substring(2, 4).toInt(16),
                clean.substring(4, 6).toInt(16)
            )
        } catch (_: Exception) { null }
    }

    private fun drawPieChartPage(
        pdfDoc: PdfDocument,
        font: PdfFont,
        title: String,
        data: List<Triple<String, Long, DeviceRgb>>,
        total: Long
    ) {
        if (data.isEmpty() || total == 0L) return

        val page = pdfDoc.addNewPage()
        val canvas = PdfCanvas(page)
        val pw = page.pageSize.width
        val ph = page.pageSize.height

        // Title
        val titleSize = 16f
        val titleWidth = font.getWidth(title, titleSize)
        canvas.setFillColor(COLOR_SECTION)
        canvas.beginText()
            .setFontAndSize(font, titleSize)
            .moveText(((pw - titleWidth) / 2).toDouble(), (ph - 55).toDouble())
            .showText(title)
            .endText()

        // Total amount
        val totalText = "\u5408\u8a08: \u00a5${String.format("%,d", total)}"
        val totalSize = 12f
        val totalWidth = font.getWidth(totalText, totalSize)
        canvas.setFillColor(DeviceRgb(100, 100, 100))
        canvas.beginText()
            .setFontAndSize(font, totalSize)
            .moveText(((pw - totalWidth) / 2).toDouble(), (ph - 78).toDouble())
            .showText(totalText)
            .endText()

        // Pie chart
        val centerX = pw / 2
        val centerY = ph - 260
        val radius = 140f

        canvas.setStrokeColor(DeviceRgb(255, 255, 255))
        canvas.setLineWidth(2f)
        var currentAngle = 90.0
        for ((_, amount, color) in data) {
            val sweep = amount.toDouble() / total * 360.0
            if (sweep < 0.1) { currentAngle -= sweep; continue }
            canvas.setFillColor(color)
            drawPieSlice(canvas, centerX, centerY, radius, currentAngle, -sweep)
            canvas.fillStroke()
            currentAngle -= sweep
        }

        // Legend
        var legendY = centerY - radius - 40
        val colWidth = (pw - 80) / 2
        val legendX1 = 45f
        val legendX2 = 45f + colWidth
        var col = 0

        for ((name, amount, color) in data) {
            val x = if (col == 0) legendX1 else legendX2
            val pct = amount.toDouble() / total * 100.0
            val label = "$name  \u00a5${String.format("%,d", amount)} (${String.format("%.1f", pct)}%)"

            canvas.setFillColor(color)
            canvas.rectangle(x.toDouble(), (legendY + 1).toDouble(), 10.0, 10.0)
            canvas.fill()

            canvas.setFillColor(DeviceRgb(51, 51, 51))
            canvas.beginText()
                .setFontAndSize(font, 9f)
                .moveText((x + 15).toDouble(), (legendY + 2).toDouble())
                .showText(label)
                .endText()

            col++
            if (col >= 2) { col = 0; legendY -= 20 }
        }

        canvas.release()
    }

    private fun drawPieSlice(canvas: PdfCanvas, cx: Float, cy: Float, radius: Float, startAngle: Double, sweep: Double) {
        val x1 = (cx - radius).toDouble()
        val y1 = (cy - radius).toDouble()
        val x2 = (cx + radius).toDouble()
        val y2 = (cy + radius).toDouble()
        val arcPoints = PdfCanvas.bezierArc(x1, y1, x2, y2, startAngle, sweep)
        if (arcPoints.isEmpty()) return
        canvas.moveTo(cx.toDouble(), cy.toDouble())
        canvas.lineTo(arcPoints[0][0], arcPoints[0][1])
        for (pts in arcPoints) {
            canvas.curveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7])
        }
        canvas.closePath()
    }

    private fun createJapaneseFont(): PdfFont {
        val fontPaths = listOf(
            "/usr/share/fonts/noto/NotoSansCJK-Regular.ttc,0",           // Alpine
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc,0",  // Debian/Ubuntu
        )
        for (path in fontPaths) {
            val filePath = path.substringBefore(",")
            if (java.io.File(filePath).exists()) {
                return PdfFontFactory.createFont(
                    path,
                    "Identity-H",
                    PdfFontFactory.EmbeddingStrategy.PREFER_EMBEDDED
                )
            }
        }
        logger.warn("No system Japanese font found, falling back to CID font (may not render correctly)")
        return PdfFontFactory.createFont("HeiseiKakuGo-W5", "Identity-H")
    }

    private fun pdfCell(
        text: String,
        font: PdfFont,
        header: Boolean = false,
        align: TextAlignment = TextAlignment.LEFT,
        textColor: DeviceRgb? = null
    ): Cell {
        val para = Paragraph(text).setFont(font)
        if (header) para.setFontColor(ColorConstants.WHITE)
        if (textColor != null) para.setFontColor(textColor)
        val cell = Cell().add(para)
        if (header) cell.setBackgroundColor(COLOR_HEADER_BG)
        cell.setTextAlignment(align)
        return cell
    }
}
