package com.kakeibo.shared.validation

object ValidationRules {
    // Amount
    const val AMOUNT_MIN = 1L
    const val AMOUNT_MAX = 9_999_999_999L

    // String lengths
    const val USERNAME_MAX_LENGTH = 50
    const val PASSWORD_MIN_LENGTH = 12
    const val ACCOUNT_NAME_MAX_LENGTH = 100
    const val CATEGORY_NAME_MAX_LENGTH = 50
    const val TAG_NAME_MAX_LENGTH = 50
    const val TRANSACTION_NAME_MAX_LENGTH = 100
    const val TEMPLATE_NAME_MAX_LENGTH = 100
    const val MEMO_MAX_LENGTH = 500
    const val KEYWORD_MAX_LENGTH = 200

    // Pagination
    const val DEFAULT_PAGE_SIZE = 50
    const val MAX_PAGE_SIZE = 100

    // Sync
    const val MAX_SYNC_CHANGES = 100

    // Import
    const val MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const val MAX_IMPORT_ROWS = 10_000

    // Backup
    const val MAX_BACKUP_FILE_SIZE = 50L * 1024 * 1024 // 50MB

    // Transaction History
    const val MAX_HISTORY_PER_TRANSACTION = 5

    // currency
    const val DEFAULT_CURRENCY = "JPY"

    // Allowed special characters for passwords
    private val SPECIAL_CHARS = setOf('@', '#', '$', '%', '^', '&', '+', '=', '!', '*', '?')

    // Common passwords blacklist
    private val COMMON_PASSWORDS = setOf(
        "password123!", "qwerty12345!", "admin12345!",
        "letmein12345", "welcome12345", "monkey12345!",
        "dragon12345!", "master12345!", "passw0rd1234",
        "123456789abc", "abcdefgh1234"
    ).map { it.lowercase() }.toSet()

    // Password pattern: at least 1 uppercase, 1 lowercase, 1 digit, 1 special char, min 12 chars
    val PASSWORD_PATTERN = Regex("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@#\$%^&+=!*?]).{12,}$")

    // UUID pattern
    val UUID_PATTERN = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

    // Color pattern (#RRGGBB)
    val COLOR_PATTERN = Regex("^#[0-9a-fA-F]{6}$")

    // Year-month pattern (YYYY-MM)
    val YEAR_MONTH_PATTERN = Regex("^\\d{4}-(0[1-9]|1[0-2])$")

    // Date pattern (YYYY-MM-DD)
    val DATE_PATTERN = Regex("^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$")

    // DateTime pattern (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss)
    val DATETIME_PATTERN = Regex("^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$")

    // Time pattern (HH:mm)
    val TIME_PATTERN = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")

    fun validatePassword(password: String): List<String> {
        val errors = mutableListOf<String>()
        if (password.length < PASSWORD_MIN_LENGTH) {
            errors.add("パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください")
        }
        if (!password.any { it.isUpperCase() }) {
            errors.add("パスワードには英大文字を1文字以上含めてください")
        }
        if (!password.any { it.isLowerCase() }) {
            errors.add("パスワードには英小文字を1文字以上含めてください")
        }
        if (!password.any { it.isDigit() }) {
            errors.add("パスワードには数字を1文字以上含めてください")
        }
        if (!password.any { it in SPECIAL_CHARS }) {
            errors.add("パスワードには記号（@#\$%^&+=!*?）を1文字以上含めてください")
        }
        if (password.lowercase() in COMMON_PASSWORDS) {
            errors.add("このパスワードは一般的すぎるため使用できません")
        }
        return errors
    }

    fun validateAmount(amount: Long): String? {
        if (amount < AMOUNT_MIN) return "金額は${AMOUNT_MIN}以上の値を指定してください"
        if (amount > AMOUNT_MAX) return "金額は${AMOUNT_MAX}以下の値を指定してください"
        return null
    }

    fun validateUuid(value: String): Boolean = UUID_PATTERN.matches(value)

    fun validateColor(value: String): Boolean = COLOR_PATTERN.matches(value)

    fun validateYearMonth(value: String): Boolean = YEAR_MONTH_PATTERN.matches(value)

    fun validateDate(value: String): Boolean = DATE_PATTERN.matches(value)

    fun validateDateTime(value: String): Boolean = DATETIME_PATTERN.matches(value)
}
