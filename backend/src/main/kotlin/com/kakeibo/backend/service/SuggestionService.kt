package com.kakeibo.backend.service

import com.kakeibo.backend.db.InputPatterns
import com.kakeibo.backend.repository.InputPatternRepository
import com.kakeibo.backend.repository.TransactionRepository
import com.kakeibo.shared.model.AutoCompleteResponse
import com.kakeibo.shared.model.MemoSuggestion

class SuggestionService(
    private val transactionRepository: TransactionRepository,
    private val inputPatternRepository: InputPatternRepository
) {
    /**
     * Get memo suggestions based on keyword prefix match.
     * Returns top 10 most frequently used memos.
     */
    fun getMemoSuggestions(keyword: String): List<MemoSuggestion> {
        if (keyword.isBlank()) return emptyList()

        val memos = transactionRepository.getDistinctMemos(keyword, 10)
        return memos.map { (memo, count) ->
            MemoSuggestion(
                memo = memo,
                frequency = count.toInt()
            )
        }
    }

    /**
     * Auto-complete category and account based on memo text.
     * Uses input_patterns table for learned associations.
     */
    fun getAutoComplete(memo: String): AutoCompleteResponse {
        if (memo.isBlank()) {
            return AutoCompleteResponse(
                category_id = null,
                account_id = null,
                confidence = 0.0
            )
        }

        // Try exact match first
        val exactMatch = inputPatternRepository.findByKeyword(memo.trim())
        if (exactMatch != null) {
            return AutoCompleteResponse(
                category_id = exactMatch[InputPatterns.categoryId]?.toString(),
                account_id = exactMatch[InputPatterns.accountId]?.toString(),
                confidence = minOf(1.0, exactMatch[InputPatterns.hitCount] / 5.0)
            )
        }

        // Try prefix match
        val prefixMatches = inputPatternRepository.searchByKeyword(memo.trim(), 1)
        if (prefixMatches.isNotEmpty()) {
            val match = prefixMatches.first()
            return AutoCompleteResponse(
                category_id = match[InputPatterns.categoryId]?.toString(),
                account_id = match[InputPatterns.accountId]?.toString(),
                confidence = minOf(0.8, match[InputPatterns.hitCount] / 10.0)
            )
        }

        return AutoCompleteResponse(
            category_id = null,
            account_id = null,
            confidence = 0.0
        )
    }
}
