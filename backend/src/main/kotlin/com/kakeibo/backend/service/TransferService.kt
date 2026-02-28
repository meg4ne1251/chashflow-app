package com.kakeibo.backend.service

import com.kakeibo.backend.db.Transfers
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.TransferRepository
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import java.time.LocalDate
import java.util.*

class TransferService(
    private val transferRepository: TransferRepository
) {
    fun getAll(dateFrom: String?, dateTo: String?, accountId: String?, page: Int, size: Int): PaginatedResponse<TransferResponse> {
        val (rows, total) = transferRepository.findAll(
            dateFrom = dateFrom?.let { LocalDate.parse(it) },
            dateTo = dateTo?.let { LocalDate.parse(it) },
            accountId = accountId?.let { UUID.fromString(it) },
            page = page,
            size = size
        )

        return PaginatedResponse(
            data = rows.map { it.toResponse() },
            pagination = PaginationInfo(
                page = page,
                size = size,
                total_count = total,
                total_pages = if (total > 0) ((total + size - 1) / size).toInt() else 0
            )
        )
    }

    fun getById(id: String): TransferResponse {
        val uuid = UUID.fromString(id)
        val row = transferRepository.findById(uuid)
            ?: throw NotFoundException("振替が見つかりません")
        if (row[Transfers.deletedAt] != null) throw NotFoundException("振替が見つかりません")
        return row.toResponse()
    }

    fun create(request: TransferRequest): TransferResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        val row = transferRepository.create(
            id = id,
            fromAccountId = UUID.fromString(request.from_account_id),
            toAccountId = UUID.fromString(request.to_account_id),
            amount = request.amount,
            currency = request.currency,
            date = LocalDate.parse(request.date),
            memo = request.memo?.trim()
        )
        return row.toResponse()
    }

    fun update(id: String, request: TransferRequest): TransferResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)
        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val row = transferRepository.update(
            id = uuid,
            fromAccountId = UUID.fromString(request.from_account_id),
            toAccountId = UUID.fromString(request.to_account_id),
            amount = request.amount,
            currency = request.currency,
            date = LocalDate.parse(request.date),
            memo = request.memo?.trim(),
            currentVersion = currentVersion
        ) ?: throw ConflictException("バージョン競合が発生しました")

        return row.toResponse()
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        transferRepository.findById(uuid)
            ?: throw NotFoundException("振替が見つかりません")

        if (!transferRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
        }
    }

    private fun ResultRow.toResponse() = TransferResponse(
        id = this[Transfers.id].toString(),
        from_account_id = this[Transfers.fromAccountId].toString(),
        to_account_id = this[Transfers.toAccountId].toString(),
        amount = this[Transfers.amount],
        currency = this[Transfers.currency],
        date = this[Transfers.date].toString(),
        memo = this[Transfers.memo],
        version = this[Transfers.version],
        created_at = this[Transfers.createdAt].toString(),
        updated_at = this[Transfers.updatedAt].toString(),
        deleted_at = this[Transfers.deletedAt]?.toString()
    )

    private fun validateRequest(request: TransferRequest) {
        val errors = mutableListOf<FieldError>()

        if (!ValidationRules.validateUuid(request.from_account_id))
            errors.add(FieldError("from_account_id", "出金元アカウントIDの形式が不正です"))
        if (!ValidationRules.validateUuid(request.to_account_id))
            errors.add(FieldError("to_account_id", "入金先アカウントIDの形式が不正です"))
        if (request.from_account_id == request.to_account_id)
            errors.add(FieldError("to_account_id", "出金元と入金先に同一アカウントは指定できません"))

        ValidationRules.validateAmount(request.amount)?.let {
            errors.add(FieldError("amount", it))
        }

        if (!ValidationRules.validateDate(request.date))
            errors.add(FieldError("date", "日付の形式が不正です（YYYY-MM-DD）"))

        request.memo?.let {
            if (it.length > ValidationRules.MEMO_MAX_LENGTH)
                errors.add(FieldError("memo", "メモは${ValidationRules.MEMO_MAX_LENGTH}文字以下で入力してください"))
        }

        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
