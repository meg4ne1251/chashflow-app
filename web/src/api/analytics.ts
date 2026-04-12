import apiClient from './client';
import type {
  DashboardResponse,
  CategoryBreakdownResponse,
  TrendResponse,
  ComparisonResponse,
  YearlySummaryResponse,
  TransactionType,
} from '@/types';

export const analyticsApi = {
  dashboard: () =>
    apiClient.get<DashboardResponse>('/analytics/dashboard'),

  categoryBreakdown: (yearMonth: string, type?: TransactionType) =>
    apiClient.get<CategoryBreakdownResponse>('/analytics/category-breakdown', {
      params: { year_month: yearMonth, type },
    }),

  trends: (from: string, to: string) =>
    apiClient.get<TrendResponse>('/analytics/trends', {
      params: { from, to },
    }),

  comparison: (yearMonth: string) =>
    apiClient.get<ComparisonResponse>('/analytics/comparison', {
      params: { year_month: yearMonth },
    }),

  yearlySummary: (year: number) =>
    apiClient.get<YearlySummaryResponse>(`/analytics/yearly/${year}`),
};
