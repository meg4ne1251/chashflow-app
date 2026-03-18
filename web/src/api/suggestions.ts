import apiClient from './client';
import type {
  MemoSuggestion,
  AutoCompleteResponse,
} from '@/types';

export const suggestionApi = {
  memo: (keyword: string) =>
    apiClient.get<MemoSuggestion[]>('/suggestions/memos', { params: { keyword } }),

  autoComplete: (memo: string) =>
    apiClient.get<AutoCompleteResponse>('/suggestions/auto-complete', { params: { memo } }),
};
