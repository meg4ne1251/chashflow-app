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
import { loginSchema, type LoginFormData } from '@/validation/schemas';
import { useAuthStore } from '@/stores/authStore';
import { AxiosError } from 'axios';
import type { ErrorResponse } from '@/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setLoading(true);
    try {
      await login(data.username, data.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        const apiError = err.response?.data as ErrorResponse | undefined;
        setError(apiError?.error?.message || 'ログインに失敗しました');
      } else {
        setError('ログインに失敗しました');
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
            家計簿
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            ログイン
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
              autoComplete="current-password"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
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
              ログイン
            </Button>
          </Box>

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            初めての方は{' '}
            <RouterLink to="/setup" style={{ color: 'inherit' }}>
              初期セットアップ
            </RouterLink>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
