import apiClient from './client';
import type { NotificationListResponse, NotificationResponse, PaginatedResponse } from '@/types';

export const notificationApi = {
  getUnread: () =>
    apiClient.get<NotificationListResponse>('/notifications'),

  getRecent: () =>
    apiClient.get<NotificationListResponse>('/notifications/recent'),

  getHistory: (params: { type?: string; is_read?: string; page?: number; size?: number }) =>
    apiClient.get<PaginatedResponse<NotificationResponse>>('/notifications/history', { params }),

  markAsRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`),

  markAllAsRead: () =>
    apiClient.put('/notifications/read-all'),
};
