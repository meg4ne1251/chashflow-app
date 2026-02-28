package com.kakeibo.backend.service

import com.kakeibo.backend.db.Categories
import com.kakeibo.backend.middleware.*
import com.kakeibo.backend.repository.CategoryRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.shared.constants.DefaultCategories
import com.kakeibo.shared.model.*
import com.kakeibo.shared.validation.ValidationRules
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.*

class CategoryService(
    private val categoryRepository: CategoryRepository,
    private val transactionRepository: TransactionRepository
) {
    fun getAll(type: String? = null): List<CategoryResponse> {
        return categoryRepository.findAll()
            .map { it.toResponse() }
            .let { categories ->
                if (type != null) categories.filter { it.type == type }
                else categories
            }
    }

    fun create(request: CategoryRequest): CategoryResponse {
        validateRequest(request)
        val id = if (request.id != null) UUID.fromString(request.id) else UUID.randomUUID()

        if (categoryRepository.existsByNameAndType(request.name.trim(), request.type)) {
            throw ValidationException("同一名称・同一種別のカテゴリが既に存在します",
                listOf(FieldError("name", "カテゴリ名が重複しています")))
        }

        val row = categoryRepository.create(
            id = id, name = request.name.trim(), type = request.type,
            icon = request.icon, color = request.color, sortOrder = request.sort_order
        )
        return row.toResponse()
    }

    fun update(id: String, request: CategoryRequest): CategoryResponse {
        validateRequest(request)
        val uuid = UUID.fromString(id)

        if (categoryRepository.existsByNameAndType(request.name.trim(), request.type, uuid)) {
            throw ValidationException("同一名称・同一種別のカテゴリが既に存在します",
                listOf(FieldError("name", "カテゴリ名が重複しています")))
        }

        val currentVersion = request.version
            ?: throw ValidationException("バージョンを指定してください", listOf(FieldError("version", "version は必須です")))

        val row = categoryRepository.update(
            id = uuid, name = request.name.trim(), type = request.type,
            icon = request.icon, color = request.color,
            sortOrder = request.sort_order, currentVersion = currentVersion
        ) ?: throw ConflictException("バージョン競合が発生しました")

        return row.toResponse()
    }

    fun delete(id: String, version: Int): Map<String, Any> {
        val uuid = UUID.fromString(id)
        val existing = categoryRepository.findActiveById(uuid)
            ?: throw NotFoundException("カテゴリが見つかりません")

        if (existing[Categories.isDefault]) {
            throw UnprocessableEntityException("デフォルトカテゴリは削除できません")
        }

        val affectedCount = transactionRepository.countByCategoryId(uuid)
        val categoryType = existing[Categories.type]

        // Always wrap in a single transaction for atomicity
        transaction {
            if (affectedCount > 0) {
                val fallbackId = if (categoryType == "expense")
                    UUID.fromString(DefaultCategories.FALLBACK_EXPENSE_ID)
                else
                    UUID.fromString(DefaultCategories.FALLBACK_INCOME_ID)

                transactionRepository.reassignCategory(uuid, fallbackId)
            }

            if (!categoryRepository.softDelete(uuid, version)) {
                throw ConflictException("バージョン競合が発生しました")
            }
        }

        return mapOf("affected_transactions" to affectedCount)
    }

    private fun validateRequest(request: CategoryRequest) {
        val errors = mutableListOf<FieldError>()
        if (request.name.isBlank()) errors.add(FieldError("name", "カテゴリ名を入力してください"))
        if (request.name.length > ValidationRules.CATEGORY_NAME_MAX_LENGTH)
            errors.add(FieldError("name", "カテゴリ名は${ValidationRules.CATEGORY_NAME_MAX_LENGTH}文字以下で入力してください"))
        if (request.type !in listOf("income", "expense"))
            errors.add(FieldError("type", "種別は income または expense を指定してください"))
        request.color?.let {
            if (!ValidationRules.validateColor(it)) errors.add(FieldError("color", "カラーコードの形式が不正です（#RRGGBB）"))
        }
        if (errors.isNotEmpty()) throw ValidationException("入力内容にエラーがあります", errors)
    }

    companion object {
        fun ResultRow.toResponse() = CategoryResponse(
            id = this[Categories.id].toString(),
            name = this[Categories.name],
            type = this[Categories.type],
            icon = this[Categories.icon],
            color = this[Categories.color],
            sort_order = this[Categories.sortOrder],
            is_default = this[Categories.isDefault],
            version = this[Categories.version],
            created_at = this[Categories.createdAt].toString(),
            updated_at = this[Categories.updatedAt].toString(),
            deleted_at = this[Categories.deletedAt]?.toString()
        )
    }
}
