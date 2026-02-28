package com.kakeibo.shared.constants

object DefaultCategories {
    const val FALLBACK_EXPENSE_ID = "a0000000-0000-0000-0000-00000000000d" // その他支出
    const val FALLBACK_INCOME_ID = "b0000000-0000-0000-0000-000000000005"  // その他収入
}

object ErrorCodes {
    const val VALIDATION_ERROR = "VALIDATION_ERROR"
    const val INVALID_REQUEST = "INVALID_REQUEST"
    const val UNAUTHORIZED = "UNAUTHORIZED"
    const val TOKEN_EXPIRED = "TOKEN_EXPIRED"
    const val TOKEN_REVOKED = "TOKEN_REVOKED"
    const val FORBIDDEN = "FORBIDDEN"
    const val NOT_FOUND = "NOT_FOUND"
    const val CONFLICT = "CONFLICT"
    const val UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY"
    const val FILE_TOO_LARGE = "FILE_TOO_LARGE"
    const val RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
}

object AppConstants {
    const val APP_VERSION = "1.0.0"
    const val SCHEMA_VERSION = 1
    const val BACKUP_VERSION = "1.0"
    const val ACCESS_TOKEN_EXPIRY_SECONDS = 900 // 15 minutes
    const val REFRESH_TOKEN_EXPIRY_DAYS = 30L
    const val ANALYTICS_CACHE_TTL_SECONDS = 300L // 5 minutes
    const val BCRYPT_COST_FACTOR = 12
}
