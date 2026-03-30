package com.kakeibo.backend.middleware

import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*

/**
 * 認証済みリクエストから安全にユーザーIDを取得する。
 * JWTPrincipalまたはuser_idクレームが欠損している場合は UnauthorizedException をスロー。
 */
fun ApplicationCall.getUserId(): String {
    val principal = principal<JWTPrincipal>()
        ?: throw UnauthorizedException("認証情報が見つかりません")
    return principal.payload.getClaim("user_id")?.asString()
        ?: throw UnauthorizedException("ユーザーIDが取得できません")
}
