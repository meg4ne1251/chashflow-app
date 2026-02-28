import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setupSchema, type SetupFormData } from '@/validation/schemas';
import { useAuthStore } from '@/stores/authStore';
import { AxiosError } from 'axios';
import type { ErrorResponse } from '@/types';

export default function SetupPage() {
  const navigate = useNavigate();
  const setup = useAuthStore((s) => s.setup);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
  });

  const onSubmit = async (data: SetupFormData) => {
    setError(null);
    setLoading(true);
    try {
      await setup(data.username, data.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        const apiError = err.response?.data as ErrorResponse | undefined;
        if (err.response?.status === 409) {
          setError('ユーザーは既にセットアップ済みです。ログインしてください。');
        } else {
          setError(apiError?.error?.message || 'セットアップに失敗しました');
        }
      } else {
        setError('セットアップに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" align="center" fontWeight={700} gutterBottom>
            初期セットアップ
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            管理者アカウントを作成します
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth
              label="ユーザー名"
              autoComplete="username"
              autoFocus
              {...register('username')}
              error={!!errors.username}
              helperText={errors.username?.message}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="パスワード"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message || '8文字以上、英大文字・小文字・数字を各1文字以上'}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="パスワード（確認）"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              セットアップ
            </Button>
          </Box>

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            既にアカウントをお持ちの方は{' '}
            <RouterLink to="/login" style={{ color: 'inherit' }}>
              ログイン
            </RouterLink>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
