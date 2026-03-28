import apiClient from './client';
import type { SavingsGoalResponse, SavingsGoalRequest, SavingsGoalSummary, SavingsDepositRequest } from '@/types';

export const savingsGoalApi = {
  list: () =>
    apiClient.get<SavingsGoalResponse[]>('/savings-goals'),

  get: (id: string) =>
    apiClient.get<SavingsGoalResponse>(`/savings-goals/${id}`),

  summary: () =>
    apiClient.get<SavingsGoalSummary[]>('/savings-goals/summary'),

  create: (data: SavingsGoalRequest) =>
    apiClient.post<SavingsGoalResponse>('/savings-goals', data),

  update: (id: string, data: SavingsGoalRequest) =>
    apiClient.put<SavingsGoalResponse>(`/savings-goals/${id}`, data),

  deposit: (id: string, data: SavingsDepositRequest) =>
    apiClient.patch<SavingsGoalResponse>(`/savings-goals/${id}/deposit`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/savings-goals/${id}`, { params: { version } }),
};
