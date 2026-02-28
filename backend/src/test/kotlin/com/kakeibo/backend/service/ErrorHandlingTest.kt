package com.kakeibo.backend.service

import com.kakeibo.backend.middleware.*
import io.ktor.http.*
import kotlin.test.*

class ErrorHandlingTest {

    @Test
    fun `ValidationException carries field errors`() {
        val fieldErrors = listOf(
            com.kakeibo.shared.model.FieldError("name", "名前が必要です"),
            com.kakeibo.shared.model.FieldError("email", "メールが不正です")
        )
        val ex = ValidationException("入力エラー", fieldErrors)
        assertEquals("入力エラー", ex.message)
        assertEquals(2, ex.details?.size)
        assertEquals(HttpStatusCode.BadRequest, ex.statusCode)
    }

    @Test
    fun `UnauthorizedException has 401 status`() {
        val ex = UnauthorizedException("認証エラー")
        assertEquals(HttpStatusCode.Unauthorized, ex.statusCode)
        assertEquals("UNAUTHORIZED", ex.errorCode)
    }

    @Test
    fun `UnauthorizedException with custom error code`() {
        val ex = UnauthorizedException("トークン失効", "TOKEN_REVOKED")
        assertEquals("TOKEN_REVOKED", ex.errorCode)
    }

    @Test
    fun `NotFoundException has 404 status`() {
        val ex = NotFoundException("リソースが見つかりません")
        assertEquals(HttpStatusCode.NotFound, ex.statusCode)
        assertEquals("NOT_FOUND", ex.errorCode)
    }

    @Test
    fun `ConflictException has 409 status`() {
        val ex = ConflictException("競合エラー")
        assertEquals(HttpStatusCode.Conflict, ex.statusCode)
        assertEquals("CONFLICT", ex.errorCode)
    }

    @Test
    fun `InvalidRequestException has 400 status`() {
        val ex = InvalidRequestException("不正なリクエスト")
        assertEquals(HttpStatusCode.BadRequest, ex.statusCode)
        assertEquals("INVALID_REQUEST", ex.errorCode)
    }

    @Test
    fun `ForbiddenException has 403 status`() {
        val ex = ForbiddenException("権限がありません")
        assertEquals(HttpStatusCode.Forbidden, ex.statusCode)
        assertEquals("FORBIDDEN", ex.errorCode)
    }

    @Test
    fun `UnprocessableEntityException has 422 status`() {
        val ex = UnprocessableEntityException("処理不能")
        assertEquals(HttpStatusCode.UnprocessableEntity, ex.statusCode)
        assertEquals("UNPROCESSABLE_ENTITY", ex.errorCode)
    }

    @Test
    fun `FileTooLargeException has 413 status`() {
        val ex = FileTooLargeException("ファイルが大きすぎます")
        assertEquals(HttpStatusCode.PayloadTooLarge, ex.statusCode)
        assertEquals("FILE_TOO_LARGE", ex.errorCode)
    }
}
