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
                writeMonthlyPdfReport(document, font, ym)
            }
            "yearly" -> {
                val y = year ?: throw ValidationException(
                    "年が必要です",
                    listOf(FieldError("year", "指定してください"))
                )
                writeYearlyPdfReport(document, font, y)
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

    private fun writeMonthlyPdfReport(document: Document, font: PdfFont, yearMonth: String) {
        val parts = yearMonth.split("-")
        val year = parts[0].toInt()
        val month = parts[1].toInt()
        val (income, expense) = transactionRepository.getMonthlySummary(year, month)
        val breakdown = transactionRepository.getCategoryBreakdown(year, month, "expense")

        document.add(
            Paragraph("月次レポート: $yearMonth")
                .setFont(font).setFontSize(18f)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(20f)
        )

        val summaryTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(1f, 1f)))
            .useAllAvailableWidth().setMarginBottom(20f)
        summaryTable.addHeaderCell(pdfCell("項目", font, header = true))
        summaryTable.addHeaderCell(pdfCell("金額", font, header = true))
        summaryTable.addCell(pdfCell("収入合計", font))
        summaryTable.addCell(pdfCell("¥${String.format("%,d", income)}", font, align = TextAlignment.RIGHT))
        summaryTable.addCell(pdfCell("支出合計", font))
        summaryTable.addCell(pdfCell("¥${String.format("%,d", expense)}", font, align = TextAlignment.RIGHT))
        summaryTable.addCell(pdfCell("収支", font))
        summaryTable.addCell(pdfCell("¥${String.format("%,d", income - expense)}", font, align = TextAlignment.RIGHT))
        document.add(summaryTable)

        if (breakdown.isNotEmpty()) {
            document.add(
                Paragraph("カテゴリ別支出")
                    .setFont(font).setFontSize(14f).setMarginBottom(10f)
            )
            val breakdownTable = PdfTable(UnitValue.createPercentArray(floatArrayOf(1f, 1f)))
                .useAllAvailableWidth()
            breakdownTable.addHeaderCell(pdfCell("カテゴリ", font, header = true))
            breakdownTable.addHeaderCell(pdfCell("金額", font, header = true))
            for ((_, name, amount) in breakdown) {
                breakdownTable.addCell(pdfCell(name, font))
                breakdownTable.addCell(pdfCell("¥${String.format("%,d", amount)}", font, align = TextAlignment.RIGHT))
            }
            document.add(breakdownTable)
        }
    }

    private fun writeYearlyPdfReport(document: Document, font: PdfFont, year: Int) {
        document.add(
            Paragraph("年間レポート: ${year}年")
                .setFont(font).setFontSize(18f)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(20f)
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
            val (income, expense) = transactionRepository.getMonthlySummary(year, month)
            totalIncome += income
            totalExpense += expense
            table.addCell(pdfCell("${month}月", font))
            table.addCell(pdfCell("¥${String.format("%,d", income)}", font, align = TextAlignment.RIGHT))
            table.addCell(pdfCell("¥${String.format("%,d", expense)}", font, align = TextAlignment.RIGHT))
            table.addCell(pdfCell("¥${String.format("%,d", income - expense)}", font, align = TextAlignment.RIGHT))
        }

        table.addCell(pdfCell("合計", font, header = true))
        table.addCell(pdfCell("¥${String.format("%,d", totalIncome)}", font, header = true, align = TextAlignment.RIGHT))
        table.addCell(pdfCell("¥${String.format("%,d", totalExpense)}", font, header = true, align = TextAlignment.RIGHT))
        table.addCell(pdfCell("¥${String.format("%,d", totalIncome - totalExpense)}", font, header = true, align = TextAlignment.RIGHT))
        document.add(table)
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

    private fun pdfCell(text: String, font: PdfFont, header: Boolean = false, align: TextAlignment = TextAlignment.LEFT): Cell {
        val cell = Cell().add(Paragraph(text).setFont(font))
        if (header) cell.setBackgroundColor(ColorConstants.LIGHT_GRAY)
        cell.setTextAlignment(align)
        return cell
    }
}
