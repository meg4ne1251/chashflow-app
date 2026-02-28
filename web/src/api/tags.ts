import apiClient from './client';
import type { TagRequest, TagResponse } from '@/types';

export const tagApi = {
  list: () =>
    apiClient.get<TagResponse[]>('/tags'),

  create: (data: TagRequest) =>
    apiClient.post<TagResponse>('/tags', data),

  update: (id: string, data: TagRequest) =>
    apiClient.put<TagResponse>(`/tags/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/tags/${id}`, { params: { version } }),
};
