import apiClient from './client';
import type {
  AccountRequest,
  AccountResponse,
} from '@/types';

export const accountApi = {
  list: () =>
    apiClient.get<AccountResponse[]>('/accounts'),

  create: (data: AccountRequest) =>
    apiClient.post<AccountResponse>('/accounts', data),

  update: (id: string, data: AccountRequest) =>
    apiClient.put<AccountResponse>(`/accounts/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/accounts/${id}`, { params: { version } }),
};
