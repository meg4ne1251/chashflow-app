import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/api/notifications';
import { useAuthStore } from '@/stores/authStore';

interface HistoryParams {
  type?: string;
  is_read?: string;
  page: number;
  size: number;
}

export function useNotificationHistory(params: HistoryParams) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notification-history', params],
    queryFn: () => notificationApi.getHistory(params),
    select: (res) => res.data,
    enabled: isAuthenticated,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-history'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-history'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}
