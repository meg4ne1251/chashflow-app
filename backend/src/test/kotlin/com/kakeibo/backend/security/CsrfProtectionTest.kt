package com.kakeibo.backend.security

import com.kakeibo.backend.middleware.CsrfProtection
import com.kakeibo.backend.routes.RouteTestHelper.configureTestApp
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlin.test.*

/**
 * CSRF (Origin 検証) ミドルウェアのテスト。
 *
 * 設計方針:
 *   - Web フロントエンド = Cookie (access_token) 認証 → ブラウザが Cookie を自動送信するため
 *     CSRF の対象。状態変更リクエストでは Origin を厳格に検証する。
 *   - Discord Bot / モバイル = Authorization: Bearer ヘッダー認証 (Cookie 無し) → 攻撃者が
 *     被害者のクレデンシャルを送らせることは不可能なので CSRF 非該当。Origin 検証はスキップする。
 *
 * 本テストは CsrfProtection プラグイン単体の振る舞いを検証する（JWT 認証の成否とは独立に
 * 「access_token Cookie の有無」と「Origin」だけで判定されることを確認する）。
 */
class CsrfProtectionTest {
    private val allowedOrigin = "https://app.example.com"

    private fun ApplicationTestBuilder.configureCsrfApp() {
        configureTestApp {
            routing {
                route("/api/v1") {
                    install(CsrfProtection) {
                        allowedOrigins = setOf(allowedOrigin)
                    }
                    post("/transactions") {
                        call.respond(HttpStatusCode.Created, mapOf("ok" to true))
                    }
                }
            }
        }
    }

    @Test
    fun `bearer header auth without cookie and without origin is allowed (bot path)`() = testApplication {
        configureCsrfApp()

        val response = client.post("/api/v1/transactions") {
            header(HttpHeaders.Authorization, "Bearer dummy-token")
        }

        // Bot は Origin を送らないが access_token Cookie も無いので CSRF はスキップされ、登録は成功する。
        assertEquals(HttpStatusCode.Created, response.status)
    }

    @Test
    fun `cookie auth with disallowed origin is rejected (browser CSRF protection holds)`() = testApplication {
        configureCsrfApp()

        val response = client.post("/api/v1/transactions") {
            header(HttpHeaders.Cookie, "access_token=any-value")
            header(HttpHeaders.Origin, "https://evil.example.com")
        }

        assertEquals(HttpStatusCode.Forbidden, response.status)
    }

    @Test
    fun `cookie auth without any origin is rejected`() = testApplication {
        configureCsrfApp()

        val response = client.post("/api/v1/transactions") {
            header(HttpHeaders.Cookie, "access_token=any-value")
        }

        assertEquals(HttpStatusCode.Forbidden, response.status)
    }

    @Test
    fun `cookie auth with allowed origin is permitted`() = testApplication {
        configureCsrfApp()

        val response = client.post("/api/v1/transactions") {
            header(HttpHeaders.Cookie, "access_token=any-value")
            header(HttpHeaders.Origin, allowedOrigin)
        }

        assertEquals(HttpStatusCode.Created, response.status)
    }
}
