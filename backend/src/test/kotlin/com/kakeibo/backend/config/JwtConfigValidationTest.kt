package com.kakeibo.backend.config

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * 弱い/プレースホルダー JWT_SECRET による起動を防ぐ検証のテスト。
 */
class JwtConfigValidationTest {

    @Test
    fun `documented default secret rejected in production`() {
        val ex = assertFailsWith<IllegalArgumentException> {
            JwtConfig.validateSecret(
                "change-me-in-production-use-a-long-random-string-at-least-256-bits",
                isProduction = true
            )
        }
        assertTrue(ex.message!!.contains("documented default", ignoreCase = true), ex.message)
    }

    @Test
    fun `documented default secret rejected in dev too`() {
        assertFailsWith<IllegalArgumentException> {
            JwtConfig.validateSecret(
                "change-me-in-production-use-a-long-random-string-at-least-256-bits",
                isProduction = false
            )
        }
    }

    @Test
    fun `placeholder pattern 'change_me' rejected in production`() {
        val ex = assertFailsWith<IllegalArgumentException> {
            JwtConfig.validateSecret(
                "dev_jwt_secret_key_change_me_in_production",
                isProduction = true
            )
        }
        assertTrue(ex.message!!.contains("placeholder", ignoreCase = true), ex.message)
    }

    @Test
    fun `placeholder pattern 'dev_jwt' rejected in production`() {
        assertFailsWith<IllegalArgumentException> {
            JwtConfig.validateSecret(
                "dev_jwt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                isProduction = true
            )
        }
    }

    @Test
    fun `placeholder allowed in non-production (tests, local dev)`() {
        // CI のテスト用 secret は本番以外で通過させる
        JwtConfig.validateSecret(
            "dev_jwt_secret_key_change_me_in_production",
            isProduction = false
        )
        JwtConfig.validateSecret(
            "test-secret-key-at-least-32-characters-long",
            isProduction = false
        )
    }

    @Test
    fun `strong random secret passes in production`() {
        // openssl rand -base64 48 で生成されるような文字列を模擬
        JwtConfig.validateSecret(
            "k9JqLm2NpRsTuVwXyZaBcDeFgHiJ7K8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B",
            isProduction = true
        )
    }
}
