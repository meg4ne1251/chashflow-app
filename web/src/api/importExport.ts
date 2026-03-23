import apiClient from './client';
import type {
  ImportPreviewResponse,
  ImportResultResponse,
  NotificationSettingResponse,
  NotificationSettingRequest,
} from '@/types';

export const importExportApi = {
  previewCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<ImportPreviewResponse>('/import/csv/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<ImportResultResponse>('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  exportCsv: (dateFrom?: string, dateTo?: string) =>
    apiClient.get('/export/csv', {
      params: { date_from: dateFrom, date_to: dateTo },
      responseType: 'blob',
    }),

  exportPdf: (type: 'monthly' | 'yearly', yearMonth?: string, year?: number) =>
    apiClient.get('/export/pdf', {
      params: { type, year_month: yearMonth, year },
      responseType: 'blob',
    }),

  backup: () =>
    apiClient.get('/backup', { responseType: 'blob' }),

  restore: (file: File, mode: 'overwrite' | 'merge') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return apiClient.post('/backup/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const notificationSettingApi = {
  list: () =>
    apiClient.get<NotificationSettingResponse[]>('/notification-settings'),

  update: (id: string, data: NotificationSettingRequest) =>
    apiClient.put<NotificationSettingResponse>(`/notification-settings/${id}`, data),
};
