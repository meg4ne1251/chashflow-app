import apiClient from './client';
import type { TemplateRequest, TemplateResponse } from '@/types';

export const templateApi = {
  list: () =>
    apiClient.get<TemplateResponse[]>('/templates'),

  create: (data: TemplateRequest) =>
    apiClient.post<TemplateResponse>('/templates', data),

  update: (id: string, data: TemplateRequest) =>
    apiClient.put<TemplateResponse>(`/templates/${id}`, data),

  delete: (id: string, version: number) =>
    apiClient.delete(`/templates/${id}`, { params: { version } }),

  use: (id: string) =>
    apiClient.post(`/templates/${id}/use`),
};
