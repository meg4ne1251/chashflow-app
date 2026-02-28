import apiClient from './client';
import type { BudgetResponse, BudgetUpsertRequest } from '@/types';

export const budgetApi = {
  list: (yearMonth: string) =>
    apiClient.get<BudgetResponse[]>('/budgets', { params: { year_month: yearMonth } }),

  upsert: (data: BudgetUpsertRequest) =>
    apiClient.put<BudgetResponse[]>('/budgets', data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/budgets/${id}`, { params: { version } }),
};
