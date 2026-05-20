package com.kakeibo.backend.service

import io.mockk.mockk
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals

class RecurringTransactionServiceTest {
    private val sut = RecurringTransactionService(
        mockk(relaxed = true),
        mockk(relaxed = true),
        mockk(relaxed = true),
        mockk(relaxed = true),
        mockk(relaxed = true)
    )

    @Test
    fun `calculateNextExecutionDate - daily`() {
        val start = LocalDate.of(2026, 1, 1)
        val result = sut.calculateNextExecutionDate("daily", 3, null, null, null, start, start)
        assertEquals(LocalDate.of(2026, 1, 4), result)
    }

    @Test
    fun `calculateNextExecutionDate - weekly`() {
        val start = LocalDate.of(2026, 1, 1) // Thursday
        // 0=Monday, 3=Thursday, 4=Friday
        val result = sut.calculateNextExecutionDate("weekly", 1, 4, null, null, start, start)
        assertEquals(LocalDate.of(2026, 1, 2), result) // Friday
    }

    @Test
    fun `calculateNextExecutionDate - monthly preserving original dayOfMonth`() {
        val start = LocalDate.of(2026, 1, 31)
        // 1回目：2026-01-31 から 2026-02-28 へ移行
        val result1 = sut.calculateNextExecutionDate("monthly", 1, null, null, null, start, start)
        assertEquals(LocalDate.of(2026, 2, 28), result1)

        // 2回目：2026-02-28 から 2026-03-31 へ移行（開始日 31日 が基準になるため、28日にズレずに31日になる）
        val result2 = sut.calculateNextExecutionDate("monthly", 1, null, null, null, result1, start)
        assertEquals(LocalDate.of(2026, 3, 31), result2)
    }

    @Test
    fun `calculateNextExecutionDate - yearly preserving original month and day`() {
        val start = LocalDate.of(2026, 2, 28) // 平年
        // 2026-02-28 から 2027-02-28
        val result = sut.calculateNextExecutionDate("yearly", 1, null, null, null, start, start)
        assertEquals(LocalDate.of(2027, 2, 28), result)
    }
}
