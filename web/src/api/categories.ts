import apiClient from './client';
import type { CategoryRequest, CategoryResponse } from '@/types';

export const categoryApi = {
  list: () =>
    apiClient.get<CategoryResponse[]>('/categories'),

  create: (data: CategoryRequest) =>
    apiClient.post<CategoryResponse>('/categories', data),

  update: (id: string, data: CategoryRequest) =>
    apiClient.put<CategoryResponse>(`/categories/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/categories/${id}`, { params: { version } }),
};
