package com.kakeibo.backend.config

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * 本番環境で弱いデフォルト DB パスワードによる起動を防ぐ fail-fast 検証のテスト。
 */
class DatabaseConfigValidationTest {

    @Test
    fun `production with default password should fail`() {
        val ex = assertFailsWith<IllegalArgumentException> {
            DatabaseConfig.validateProductionConfig(password = "kakeibo", isProduction = true)
        }
        assertTrue(
            ex.message!!.contains("default value"),
            "Expected message about default value, got: ${ex.message}"
        )
    }

    @Test
    fun `production with short password should fail`() {
        val ex = assertFailsWith<IllegalArgumentException> {
            DatabaseConfig.validateProductionConfig(password = "short", isProduction = true)
        }
        assertTrue(
            ex.message!!.contains("at least 12"),
            "Expected message about length, got: ${ex.message}"
        )
    }

    @Test
    fun `production with strong password should pass`() {
        DatabaseConfig.validateProductionConfig(
            password = "S7r0ng-P@ssw0rd-Example!",
            isProduction = true
        )
    }

    @Test
    fun `non-production with default password should pass`() {
        DatabaseConfig.validateProductionConfig(password = "kakeibo", isProduction = false)
    }
}
