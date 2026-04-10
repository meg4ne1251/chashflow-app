import apiClient from './client';
import type {
  TransactionRequest,
  TransactionResponse,
  TransactionHistoryResponse,
  TransactionType,
  PaginatedResponse,
} from '@/types';

export interface TransactionQueryParams {
  date_from?: string;
  date_to?: string;
  type?: TransactionType;
  category_id?: string;
  account_id?: string;
  tag_ids?: string;
  keyword?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export const transactionApi = {
  list: (params?: TransactionQueryParams) =>
    apiClient.get<PaginatedResponse<TransactionResponse>>('/transactions', { params }),

  get: (id: string) =>
    apiClient.get<TransactionResponse>(`/transactions/${id}`),

  create: (data: TransactionRequest) =>
    apiClient.post<TransactionResponse>('/transactions', data),

  update: (id: string, data: TransactionRequest) =>
    apiClient.put<TransactionResponse>(`/transactions/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/transactions/${id}`, { params: { version } }),

  restore: (id: string) =>
    apiClient.patch<TransactionResponse>(`/transactions/${id}/restore`),

  getHistory: (id: string) =>
    apiClient.get<TransactionHistoryResponse[]>(`/transactions/${id}/history`),
};
