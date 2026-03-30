package com.kakeibo.backend.routes

import com.kakeibo.backend.middleware.ValidationException
import com.kakeibo.shared.model.FieldError
import java.util.UUID

/**
 * Validates and extracts UUID from path parameters.
 * 
 * @param value The parameter value to validate
 * @param paramName The parameter name for error messages (default: "id")
 * @return The validated UUID string
 * @throws ValidationException if the value is null, blank, or not a valid UUID
 */
fun validateUuidParam(value: String?, paramName: String = "id"): String {
    if (value.isNullOrBlank()) {
        throw ValidationException(
            "${paramName}が指定されていません",
            listOf(FieldError(paramName, "${paramName}は必須です"))
        )
    }
    try {
        UUID.fromString(value)
    } catch (e: IllegalArgumentException) {
        throw ValidationException(
            "無効な${paramName}形式です",
            listOf(FieldError(paramName, "UUID形式で指定してください"))
        )
    }
    return value
}

/**
 * Validates version parameter for optimistic locking.
 * 
 * @param version The version value to validate
 * @param paramName The parameter name for error messages (default: "version")
 * @return The validated version number
 * @throws ValidationException if the version is null or out of valid range
 */
fun validateVersionParam(version: Int?, paramName: String = "version"): Int {
    if (version == null) {
        throw ValidationException(
            "${paramName}を指定してください",
            listOf(FieldError(paramName, "${paramName}は必須です"))
        )
    }
    if (version < 0 || version > 999_999) {
        throw ValidationException(
            "${paramName}が無効です",
            listOf(FieldError(paramName, "${paramName}は0以上999999以下で指定してください"))
        )
    }
    return version
}
