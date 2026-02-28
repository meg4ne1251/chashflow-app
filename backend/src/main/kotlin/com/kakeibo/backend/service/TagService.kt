package com.kakeibo.backend.service

import com.kakeibo.backend.db.Tags
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.*
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class TagService(
    private val tagRepository: TagRepository,
    private val transactionTagRepository: TransactionTagRepository,
    private val templateTagRepository: TemplateTagRepository,
    private val recurringTransactionTagRepository: RecurringTransactionTagRepository
) {
    fun getAll(): List<TagResponse> {
        return tagRepository.findAll().map { it.toResponse() }
    }

    fun create(request: TagRequest): TagResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        if (tagRepository.existsByName(request.name.trim())) {
            throw ValidationException("同一名称のタグが既に存在します",
                listOf(FieldError("name", "タグ名が重複しています")))
        }

        val row = tagRepository.create(id, request.name.trim(), request.color)
        return row.toResponse()
    }

    fun update(id: String, request: TagRequest): TagResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)

        if (tagRepository.existsByName(request.name.trim(), uuid)) {
            throw ValidationException("同一名称のタグが既に存在します",
                listOf(FieldError("name", "タグ名が重複しています")))
        }

        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val row = tagRepository.update(uuid, request.name.trim(), request.color, currentVersion)
            ?: throw ConflictException("バージョン競合が発生しました")

        return row.toResponse()
    }

    fun delete(id: String, version: Int): Map<String, Any> {
        val uuid = UUID.fromString(id)
        tagRepository.findActiveById(uuid)
            ?: throw NotFoundException("タグが見つかりません")

        val affectedCount = transactionTagRepository.countByTagId(uuid)

        transaction {
            // Physical delete junction records
            transactionTagRepository.deleteByTagId(uuid)
            templateTagRepository.deleteByTagId(uuid)
            recurringTransactionTagRepository.deleteByTagId(uuid)
            // Logical delete the tag
            tagRepository.softDelete(uuid, version)
        }

        return mapOf("affected_transactions" to affectedCount)
    }

    companion object {
        fun ResultRow.toResponse() = TagResponse(
            id = this[Tags.id].toString(),
            name = this[Tags.name],
            color = this[Tags.color],
            version = this[Tags.version],
            created_at = this[Tags.createdAt].toString(),
            updated_at = this[Tags.updatedAt].toString(),
            deleted_at = this[Tags.deletedAt]?.toString()
        )
    }

    private fun validateRequest(request: TagRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.name.isBlank()) errors.add(FieldError("name", "タグ名を入力してください"))
        if (request.name.length > ValidationRules.TAG_NAME_MAX_LENGTH)
            errors.add(FieldError("name", "タグ名は${ValidationRules.TAG_NAME_MAX_LENGTH}文字以下で入力してください"))
        request.color?.let {
            if (!ValidationRules.validateColor(it)) errors.add(FieldError("color", "カラーコードの形式が不正です"))
        }
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }
}
