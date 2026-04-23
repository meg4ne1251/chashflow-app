import { useState, useEffect } from 'react';
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
import { zodFormResolver } from '@/validation/resolver';
import { setupSchema, type SetupFormData } from '@/validation/schemas';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/auth';
import { AxiosError } from 'axios';
import { getApiErrorMessage } from '@/types';

export default function SetupPage() {
  const navigate = useNavigate();
  const setup = useAuthStore((s) => s.setup);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authApi.setupStatus()
      .then((res) => {
        if (!res.data.needs_setup) {
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        // If status check fails, allow the form to show
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SetupFormData>({
    resolver: zodFormResolver(setupSchema),
  });

  const onSubmit = async (data: SetupFormData) => {
    setError(null);
    setLoading(true);
    try {
      await setup(data.username, data.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 409) {
          setError('ユーザーは既にセットアップ済みです。ログインしてください。');
        } else if (err.response?.status === 429) {
          setError('リクエストが多すぎます。しばらく待ってからもう一度お試しください。');
        } else {
          setError(getApiErrorMessage(err.response?.data) || 'セットアップに失敗しました');
        }
      } else {
        setError('セットアップに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

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
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '14px',
                background:
                  'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                color: 'var(--accent-ink)',
                display: 'inline-grid',
                placeItems: 'center',
                mb: 1.5,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              ¥
            </Box>
            <Typography
              variant="h5"
              fontWeight={600}
              sx={{ letterSpacing: '-0.02em' }}
            >
              初期セットアップ
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              管理者アカウントを作成します
            </Typography>
          </Box>

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
              helperText={errors.password?.message}
              sx={{ mb: 0 }}
            />
            <PasswordRequirements password={watch('password') || ''} />
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
