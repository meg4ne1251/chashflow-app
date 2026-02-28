import apiClient from './client';
import type {
  RecurringTransactionRequest,
  RecurringTransactionResponse,
} from '@/types';

export const recurringTransactionApi = {
  list: () =>
    apiClient.get<RecurringTransactionResponse[]>('/recurring-transactions'),

  create: (data: RecurringTransactionRequest) =>
    apiClient.post<RecurringTransactionResponse>('/recurring-transactions', data),

  update: (id: string, data: RecurringTransactionRequest) =>
    apiClient.put<RecurringTransactionResponse>(`/recurring-transactions/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/recurring-transactions/${id}`, { params: { version } }),

  toggle: (id: string) =>
    apiClient.patch<RecurringTransactionResponse>(`/recurring-transactions/${id}/toggle`),
};
