package com.kakeibo.backend.service

import com.kakeibo.backend.TestHelper
import com.kakeibo.backend.db.Accounts
import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.db.Transactions
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import io.mockk.*
import org.jetbrains.exposed.sql.ResultRow
import java.io.ByteArrayInputStream
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.util.*
import kotlin.test.*

class ImportExportServiceTest {
    private lateinit var transactionRepository: TransactionRepository
    private lateinit var transactionTagRepository: TransactionTagRepository
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var accountRepository: AccountRepository
    private lateinit var tagRepository: TagRepository
    private lateinit var templateRepository: TemplateRepository
    private lateinit var templateTagRepository: TemplateTagRepository
    private lateinit var recurringTransactionRepository: RecurringTransactionRepository
    private lateinit var recurringTransactionTagRepository: RecurringTransactionTagRepository
    private lateinit var budgetRepository: BudgetRepository
    private lateinit var transferRepository: TransferRepository
    private lateinit var notificationSettingRepository: NotificationSettingRepository
    private lateinit var inputPatternRepository: InputPatternRepository
    private lateinit var transactionHistoryRepository: TransactionHistoryRepository
    
    private lateinit var sut: ImportExportService

    @BeforeTest
    fun setUp() {
        TestHelper.initTestDatabase()
        
        transactionRepository = mockk(relaxed = true)
        transactionTagRepository = mockk(relaxed = true)
        categoryRepository = mockk(relaxed = true)
        accountRepository = mockk(relaxed = true)
        tagRepository = mockk(relaxed = true)
        templateRepository = mockk(relaxed = true)
        templateTagRepository = mockk(relaxed = true)
        recurringTransactionRepository = mockk(relaxed = true)
        recurringTransactionTagRepository = mockk(relaxed = true)
        budgetRepository = mockk(relaxed = true)
        transferRepository = mockk(relaxed = true)
        notificationSettingRepository = mockk(relaxed = true)
        inputPatternRepository = mockk(relaxed = true)
        transactionHistoryRepository = mockk(relaxed = true)

        sut = ImportExportService(
            transactionRepository,
            transactionTagRepository,
            categoryRepository,
            accountRepository,
            tagRepository,
            templateRepository,
            templateTagRepository,
            recurringTransactionRepository,
            recurringTransactionTagRepository,
            budgetRepository,
            transferRepository,
            notificationSettingRepository,
            inputPatternRepository,
            transactionHistoryRepository
        )
    }

    // =========================================================================
    // previewCsvImport() tests
    // =========================================================================

    @Test
    fun `previewCsvImport - should parse valid CSV stream`() {
        val csvData = """
            日付,種別,金額,名前,カテゴリ,決済手段,メモ,タグ,作成日時,更新日時
            2026-05-20T10:00,支出,1500,お弁当,食費,現金,ランチ,コンビニ,2026-05-20T10:00,2026-05-20T10:00
        """.trimIndent()

        val inputStream = ByteArrayInputStream(csvData.toByteArray(Charsets.UTF_8))
        val response = sut.previewCsvImport(inputStream, csvData.length.toLong())

        assertEquals(1, response.total_rows)
        assertEquals(1, response.valid_rows)
        assertEquals(0, response.error_rows)
        assertEquals(1, response.preview.size)
        assertEquals("2026-05-20T10:00", response.preview[0].date)
        assertEquals("支出", response.preview[0].type)
        assertEquals(1500L, response.preview[0].amount)
        assertEquals("食費", response.preview[0].category_name)
        assertEquals("現金", response.preview[0].account_name)
    }

    @Test
    fun `previewCsvImport - should detect invalid row content`() {
        // validateImportRow checks presence of date, type, amount, and if amount is numeric.
        // We leave date blank and set amount to a non-numeric string "abc".
        val csvData = """
            日付,種別,金額,名前,カテゴリ,決済手段,メモ,タグ,作成日時,更新日時
            ,支出,abc,お弁当,食費,現金,ランチ,コンビニ,2026-05-20T10:00,2026-05-20T10:00
        """.trimIndent()

        val inputStream = ByteArrayInputStream(csvData.toByteArray(Charsets.UTF_8))
        val response = sut.previewCsvImport(inputStream, csvData.length.toLong())

        assertEquals(1, response.total_rows)
        assertEquals(0, response.valid_rows)
        assertEquals(1, response.error_rows)
        assertTrue(response.errors.isNotEmpty())
    }

    // =========================================================================
    // importCsv() tests
    // =========================================================================

    @Test
    fun `importCsv - should skip rows with missing category or account`() {
        val csvData = """
            日付,種別,金額,名前,カテゴリ,決済手段,メモ,タグ,作成日時,更新日時
            2026-05-20T10:00,支出,1500,お弁当,存在しないカテゴリ,存在しない決済手段,ランチ,コンビニ,2026-05-20T10:00,2026-05-20T10:00
        """.trimIndent()

        val categoryId = UUID.randomUUID()
        val categoryMock = mockk<ResultRow>()
        every { categoryMock[Categories.id] } returns categoryId
        every { categoryMock[Categories.name] } returns "食費"
        every { categoryMock[Categories.type] } returns "expense"
        every { categoryMock[Categories.deletedAt] } returns null

        val accountId = UUID.randomUUID()
        val accountMock = mockk<ResultRow>()
        every { accountMock[Accounts.id] } returns accountId
        every { accountMock[Accounts.name] } returns "現金"
        every { accountMock[Accounts.type] } returns "cash"
        every { accountMock[Accounts.deletedAt] } returns null

        // Setup mock repos
        every { categoryRepository.findAll(includeDeleted = true) } returns listOf(categoryMock)
        every { accountRepository.findAll(includeDeleted = true) } returns listOf(accountMock)

        val inputStream = ByteArrayInputStream(csvData.toByteArray(Charsets.UTF_8))
        val response = sut.importCsv(inputStream, csvData.length.toLong())

        assertEquals(0, response.imported_count)
        assertEquals(1, response.skipped_count)
        assertEquals(1, response.errors.size)
        assertTrue(response.errors[0].message?.contains("カテゴリ") == true)
    }

    @Test
    fun `importCsv - should succeed to import valid rows`() {
        val csvData = """
            日付,種別,金額,名前,カテゴリ,決済手段,メモ,タグ,作成日時,更新日時
            2026-05-20T10:00,支出,1500,お弁当,食費,現金,ランチ,コンビニ,2026-05-20T10:00,2026-05-20T10:00
        """.trimIndent()

        val categoryId = UUID.randomUUID()
        val categoryMock = mockk<ResultRow>()
        every { categoryMock[Categories.id] } returns categoryId
        every { categoryMock[Categories.name] } returns "食費"
        every { categoryMock[Categories.type] } returns "expense"
        every { categoryMock[Categories.deletedAt] } returns null

        val accountId = UUID.randomUUID()
        val accountMock = mockk<ResultRow>()
        every { accountMock[Accounts.id] } returns accountId
        every { accountMock[Accounts.name] } returns "現金"
        every { accountMock[Accounts.type] } returns "cash"
        every { accountMock[Accounts.deletedAt] } returns null

        every { categoryRepository.findAll(includeDeleted = true) } returns listOf(categoryMock)
        every { accountRepository.findAll(includeDeleted = true) } returns listOf(accountMock)

        every {
            transactionRepository.create(
                id = any(), type = "expense", amount = 1500L, currency = "JPY",
                date = any(), memo = "ランチ", categoryId = categoryId, accountId = accountId, name = "お弁当"
            )
        } returns mockk(relaxed = true)

        val inputStream = ByteArrayInputStream(csvData.toByteArray(Charsets.UTF_8))
        val response = sut.importCsv(inputStream, csvData.length.toLong())

        assertEquals(1, response.imported_count)
        assertEquals(0, response.skipped_count)
        assertEquals(0, response.errors.size)
    }

    // =========================================================================
    // exportCsv() tests
    // =========================================================================

    @Test
    fun `exportCsv - should export valid CSV byte array`() {
        val txId = UUID.randomUUID()
        val txMock = mockk<ResultRow>()
        every { txMock[Transactions.id] } returns txId
        every { txMock[Transactions.name] } returns "お給料"
        every { txMock[Transactions.type] } returns "income"
        every { txMock[Transactions.amount] } returns 250000L
        every { txMock[Transactions.date] } returns LocalDateTime.parse("2026-05-20T10:00")
        every { txMock[Transactions.memo] } returns "ボーナス"
        every { txMock[Transactions.categoryId] } returns null
        every { txMock[Transactions.accountId] } returns null
        every { txMock[Transactions.createdAt] } returns OffsetDateTime.parse("2026-05-20T10:00:00Z")
        every { txMock[Transactions.updatedAt] } returns OffsetDateTime.parse("2026-05-20T10:00:00Z")
        every { txMock[Transactions.deletedAt] } returns null

        every {
            transactionRepository.findAll(any(), any(), any(), any(), any())
        } returns Pair(listOf(txMock), 1L)

        val response = sut.exportCsv("2026-05-01", "2026-05-31")
        val csvString = String(response, Charsets.UTF_8)

        assertTrue(csvString.contains("お給料"))
        assertTrue(csvString.contains("収入"))
        assertTrue(csvString.contains("250000"))
    }
}
