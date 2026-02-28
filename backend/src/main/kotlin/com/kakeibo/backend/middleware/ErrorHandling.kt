package com.kakeibo.backend.middleware

import com.kakeibo.shared.constants.ErrorCodes
import com.kakeibo.shared.model.ErrorBody
import com.kakeibo.shared.model.ErrorResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("ErrorHandling")

// Custom exception types
open class AppException(
    val statusCode: HttpStatusCode,
    val errorCode: String,
    override val message: String,
    val details: List<com.kakeibo.shared.model.FieldError>? = null,
    val serverData: kotlinx.serialization.json.JsonObject? = null
) : RuntimeException(message)

class ValidationException(
    message: String,
    details: List<com.kakeibo.shared.model.FieldError>? = null
) : AppException(HttpStatusCode.BadRequest, ErrorCodes.VALIDATION_ERROR, message, details)

class InvalidRequestException(message: String = "リクエスト形式が不正です") :
    AppException(HttpStatusCode.BadRequest, ErrorCodes.INVALID_REQUEST, message)

class UnauthorizedException(message: String = "認証が必要です", errorCode: String = ErrorCodes.UNAUTHORIZED) :
    AppException(HttpStatusCode.Unauthorized, errorCode, message)

class ForbiddenException(message: String = "操作権限がありません") :
    AppException(HttpStatusCode.Forbidden, ErrorCodes.FORBIDDEN, message)

class NotFoundException(message: String = "リソースが見つかりません") :
    AppException(HttpStatusCode.NotFound, ErrorCodes.NOT_FOUND, message)

class ConflictException(
    message: String = "バージョン競合が発生しました",
    serverData: kotlinx.serialization.json.JsonObject? = null
) : AppException(HttpStatusCode.Conflict, ErrorCodes.CONFLICT, message, serverData = serverData)

class UnprocessableEntityException(message: String) :
    AppException(HttpStatusCode.UnprocessableEntity, ErrorCodes.UNPROCESSABLE_ENTITY, message)

class FileTooLargeException(message: String = "ファイルサイズが上限を超えています") :
    AppException(HttpStatusCode.PayloadTooLarge, ErrorCodes.FILE_TOO_LARGE, message)

fun Application.configureErrorHandling() {
    install(StatusPages) {
        exception<AppException> { call, cause ->
            logger.warn("Application error: ${cause.errorCode} - ${cause.message}")
            call.respond(
                cause.statusCode,
                ErrorResponse(
                    error = ErrorBody(
                        code = cause.errorCode,
                        message = cause.message,
                        details = cause.details,
                        server_data = cause.serverData
                    )
                )
            )
        }

        exception<kotlinx.serialization.SerializationException> { call, cause ->
            logger.warn("Serialization error: ${cause.message}")
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(
                    error = ErrorBody(
                        code = ErrorCodes.INVALID_REQUEST,
                        message = "リクエストの解析に失敗しました"
                    )
                )
            )
        }

        exception<Throwable> { call, cause ->
            logger.error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(
                    error = ErrorBody(
                        code = ErrorCodes.INTERNAL_ERROR,
                        message = "サーバー内部エラーが発生しました"
                    )
                )
            )
        }
    }
}
