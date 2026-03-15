package com.kakeibo.backend.service

import com.kakeibo.backend.db.Templates
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.TagRepository
import com.kakeibo.backend.repository.TemplateRepository
import com.kakeibo.backend.repository.TemplateTagRepository
import com.kakeibo.backend.service.TagService.Companion.toResponse as tagToResponse
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class TemplateService(
    private val templateRepository: TemplateRepository,
    private val templateTagRepository: TemplateTagRepository,
    private val tagRepository: TagRepository
) {
    fun getAll(): List<TemplateResponse> {
        return templateRepository.findAll().map { it.toResponse() }
    }

    fun create(request: TemplateRequest): TemplateResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        val row = transaction {
            val created = templateRepository.create(
                id = id,
                name = request.name.trim(),
                type = request.type,
                amount = request.amount,
                currency = request.currency,
                categoryId = request.category_id?.let { UUID.fromString(it) },
                accountId = request.account_id?.let { UUID.fromString(it) },
                memo = request.memo?.trim()
            )

            if (request.tag_ids.isNotEmpty()) {
                templateTagRepository.setTags(id, request.tag_ids.map { UUID.fromString(it) })
            }

            created
        }

        return row.toResponse()
    }

    fun update(id: String, request: TemplateRequest): TemplateResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)
        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val row = transaction {
            val updated = templateRepository.update(
                id = uuid,
                name = request.name.trim(),
                type = request.type,
                amount = request.amount,
                currency = request.currency,
                categoryId = request.category_id?.let { UUID.fromString(it) },
                accountId = request.account_id?.let { UUID.fromString(it) },
                memo = request.memo?.trim(),
                currentVersion = currentVersion
            ) ?: throw ConflictException("バージョン競合が発生しました")

            templateTagRepository.setTags(uuid, request.tag_ids.map { UUID.fromString(it) })
            updated
        }

        return row.toResponse()
    }

    fun delete(id: String, version: Int) {
        val uuid = UUID.fromString(id)
        templateRepository.findById(uuid)
            ?: throw NotFoundException("テンプレートが見つかりません")

        if (!templateRepository.softDelete(uuid, version)) {
            throw ConflictException("バージョン競合が発生しました")
        }
    }

    private fun ResultRow.toResponse(): TemplateResponse {
        val templateId = this[Templates.id]
        val tagIds = templateTagRepository.findByTemplateId(templateId)
        val tags = if (tagIds.isNotEmpty()) {
            tagRepository.findByIds(tagIds).map { it.tagToResponse() }
        } else emptyList()

        return TemplateResponse(
            id = templateId.toString(),
            name = this[Templates.name],
            type = this[Templates.type],
            amount = this[Templates.amount],
            currency = this[Templates.currency],
            category_id = this[Templates.categoryId]?.toString(),
            account_id = this[Templates.accountId]?.toString(),
            memo = this[Templates.memo],
            tags = tags,
            use_count = this[Templates.useCount],
            last_used_at = this[Templates.lastUsedAt]?.toString(),
            version = this[Templates.version],
            created_at = this[Templates.createdAt].toString(),
            updated_at = this[Templates.updatedAt].toString(),
            deleted_at = this[Templates.deletedAt]?.toString()
        )
    }

    private fun validateRequest(request: TemplateRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.name.isBlank()) errors.add(FieldError("name", "テンプレート名を入力してください"))
        if (request.name.length > ValidationRules.TEMPLATE_NAME_MAX_LENGTH)
            errors.add(FieldError("name", "テンプレート名は${ValidationRules.TEMPLATE_NAME_MAX_LENGTH}文字以下で入力してください"))
        if (request.type !in com.kakeibo.shared.model.TransactionType.entries.map { it.value })
            errors.add(FieldError("type", "種別は income または expense を指定してください"))
        request.amount?.let { amount ->
            ValidationRules.validateAmount(amount)?.let {
                errors.add(FieldError("amount", it))
            }
        }
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
