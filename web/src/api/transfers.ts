import apiClient from './client';
import type {
  TransferRequest,
  TransferResponse,
  PaginatedResponse,
} from '@/types';

export interface TransferQueryParams {
  date_from?: string;
  date_to?: string;
  account_id?: string;
  page?: number;
  size?: number;
}

export const transferApi = {
  list: (params?: TransferQueryParams) =>
    apiClient.get<PaginatedResponse<TransferResponse>>('/transfers', { params }),

  get: (id: string) =>
    apiClient.get<TransferResponse>(`/transfers/${id}`),

  create: (data: TransferRequest) =>
    apiClient.post<TransferResponse>('/transfers', data),

  update: (id: string, data: TransferRequest) =>
    apiClient.put<TransferResponse>(`/transfers/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/transfers/${id}`, { params: { version } }),

  restore: (id: string) =>
    apiClient.patch<TransferResponse>(`/transfers/${id}/restore`),
};
