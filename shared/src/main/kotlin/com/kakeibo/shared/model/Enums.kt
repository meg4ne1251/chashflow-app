package com.kakeibo.shared.model

import kotlinx.serialization.Serializable

@Serializable
enum class TransactionType(val value: String) {
    INCOME("income"),
    EXPENSE("expense");

    companion object {
        fun fromValue(value: String): TransactionType =
            entries.find { it.value == value }
                ?: throw IllegalArgumentException("Invalid transaction type: $value")
    }
}

@Serializable
enum class AccountType(val value: String) {
    CASH("cash"),
    BANK("bank"),
    CREDIT_CARD("credit_card"),
    E_MONEY("e_money"),
    OTHER("other");

    companion object {
        fun fromValue(value: String): AccountType =
            entries.find { it.value == value }
                ?: throw IllegalArgumentException("Invalid account type: $value")
    }
}

@Serializable
enum class Frequency(val value: String) {
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly"),
    YEARLY("yearly");

    companion object {
        fun fromValue(value: String): Frequency =
            entries.find { it.value == value }
                ?: throw IllegalArgumentException("Invalid frequency: $value")
    }
}

@Serializable
enum class NotificationType(val value: String) {
    INPUT_REMIND("input_remind"),
    BUDGET_ALERT("budget_alert"),
    CREDIT_CARD_PAYMENT("credit_card_payment");

    companion object {
        fun fromValue(value: String): NotificationType =
            entries.find { it.value == value }
                ?: throw IllegalArgumentException("Invalid notification type: $value")
    }
}

@Serializable
enum class ReminderFrequency(val value: String) {
    DAILY("daily"),
    WEEKLY("weekly"),
    BIWEEKLY("biweekly"),
    CUSTOM("custom");

    companion object {
        fun fromValue(value: String): ReminderFrequency =
            entries.find { it.value == value }
                ?: throw IllegalArgumentException("Invalid reminder frequency: $value")
    }
}
