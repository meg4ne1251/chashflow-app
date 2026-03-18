import apiClient from './client';
import type { NotificationListResponse } from '@/types';

export const notificationApi = {
  getUnread: () =>
    apiClient.get<NotificationListResponse>('/notifications'),

  getRecent: () =>
    apiClient.get<NotificationListResponse>('/notifications/recent'),

  markAsRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`),

  markAllAsRead: () =>
    apiClient.put('/notifications/read-all'),
};
