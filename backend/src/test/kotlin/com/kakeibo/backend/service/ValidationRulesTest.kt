package com.kakeibo.backend.service

import com.kakeibo.shared.validation.ValidationRules
import kotlin.test.*

class ValidationRulesTest {

    // ===========================
    // Password Validation
    // ===========================

    @Test
    fun `validatePassword - valid password returns empty list`() {
        // 12文字以上、英大小数字記号を含む
        val errors = ValidationRules.validatePassword("StrongPass1!")
        assertTrue(errors.isEmpty(), "Expected no errors but got: $errors")
    }

    @Test
    fun `validatePassword - too short returns error`() {
        val errors = ValidationRules.validatePassword("Pass1!")
        assertTrue(errors.isNotEmpty())
        assertTrue(errors.any { it.contains("${ValidationRules.PASSWORD_MIN_LENGTH}文字") })
    }

    @Test
    fun `validatePassword - no uppercase returns error`() {
        val errors = ValidationRules.validatePassword("password1!ab")
        assertTrue(errors.isNotEmpty())
        assertTrue(errors.any { it.contains("英大文字") })
    }

    @Test
    fun `validatePassword - no lowercase returns error`() {
        val errors = ValidationRules.validatePassword("PASSWORD1!AB")
        assertTrue(errors.isNotEmpty())
        assertTrue(errors.any { it.contains("英小文字") })
    }

    @Test
    fun `validatePassword - no digit returns error`() {
        val errors = ValidationRules.validatePassword("PasswordOnly!")
        assertTrue(errors.isNotEmpty())
        assertTrue(errors.any { it.contains("数字") })
    }

    @Test
    fun `validatePassword - no special char returns error`() {
        val errors = ValidationRules.validatePassword("PasswordOnly1")
        assertTrue(errors.isNotEmpty())
        assertTrue(errors.any { it.contains("記号") })
    }

    // ===========================
    // Amount Validation
    // ===========================

    @Test
    fun `validateAmount - valid amount returns null`() {
        assertNull(ValidationRules.validateAmount(100))
        assertNull(ValidationRules.validateAmount(1))
        assertNull(ValidationRules.validateAmount(9_999_999_999L))
    }

    @Test
    fun `validateAmount - zero returns error`() {
        assertNotNull(ValidationRules.validateAmount(0))
    }

    @Test
    fun `validateAmount - negative returns error`() {
        assertNotNull(ValidationRules.validateAmount(-1))
    }

    @Test
    fun `validateAmount - exceeds max returns error`() {
        assertNotNull(ValidationRules.validateAmount(10_000_000_000L))
    }

    // ===========================
    // UUID Validation
    // ===========================

    @Test
    fun `validateUuid - valid UUID returns true`() {
        assertTrue(ValidationRules.validateUuid("550e8400-e29b-41d4-a716-446655440000"))
    }

    @Test
    fun `validateUuid - invalid UUID returns false`() {
        assertFalse(ValidationRules.validateUuid("not-a-uuid"))
        assertFalse(ValidationRules.validateUuid(""))
    }

    // ===========================
    // Color Validation
    // ===========================

    @Test
    fun `validateColor - valid color returns true`() {
        assertTrue(ValidationRules.validateColor("#FF0000"))
        assertTrue(ValidationRules.validateColor("#00ff00"))
        assertTrue(ValidationRules.validateColor("#aAbBcC"))
    }

    @Test
    fun `validateColor - invalid color returns false`() {
        assertFalse(ValidationRules.validateColor("FF0000"))
        assertFalse(ValidationRules.validateColor("#FFF"))
        assertFalse(ValidationRules.validateColor("#GGGGGG"))
        assertFalse(ValidationRules.validateColor(""))
    }

    // ===========================
    // Year-Month Validation
    // ===========================

    @Test
    fun `validateYearMonth - valid format returns true`() {
        assertTrue(ValidationRules.validateYearMonth("2024-01"))
        assertTrue(ValidationRules.validateYearMonth("2024-12"))
    }

    @Test
    fun `validateYearMonth - invalid format returns false`() {
        assertFalse(ValidationRules.validateYearMonth("2024-13"))
        assertFalse(ValidationRules.validateYearMonth("2024-00"))
        assertFalse(ValidationRules.validateYearMonth("24-01"))
        assertFalse(ValidationRules.validateYearMonth("2024/01"))
    }

    // ===========================
    // Date Validation
    // ===========================

    @Test
    fun `validateDate - valid date returns true`() {
        assertTrue(ValidationRules.validateDate("2024-01-01"))
        assertTrue(ValidationRules.validateDate("2024-12-31"))
    }

    @Test
    fun `validateDate - invalid date returns false`() {
        assertFalse(ValidationRules.validateDate("2024-13-01"))
        assertFalse(ValidationRules.validateDate("2024-01-32"))
        assertFalse(ValidationRules.validateDate("2024/01/01"))
    }
}
