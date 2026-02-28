import apiClient from './client';
import type {
  ImportPreviewResponse,
  ImportResultResponse,
  NotificationSettingResponse,
  NotificationSettingRequest,
} from '@/types';

export const importExportApi = {
  previewExcel: (file: File, columnMapping: Record<string, string>) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('column_mapping', JSON.stringify(columnMapping));
    return apiClient.post<ImportPreviewResponse>('/import/excel/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  importExcel: (file: File, columnMapping: Record<string, string>) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('column_mapping', JSON.stringify(columnMapping));
    return apiClient.post<ImportResultResponse>('/import/excel', formData, {
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
