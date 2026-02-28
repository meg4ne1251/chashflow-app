import { Box, Typography } from '@mui/material';
import { Check, Close } from '@mui/icons-material';

const rules = [
  { test: (v: string) => v.length >= 8, label: '8文字以上' },
  { test: (v: string) => /[A-Z]/.test(v), label: '英大文字を含む' },
  { test: (v: string) => /[a-z]/.test(v), label: '英小文字を含む' },
  { test: (v: string) => /[0-9]/.test(v), label: '数字を含む' },
] as const;

interface Props {
  password: string;
}

export default function PasswordRequirements({ password }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, ml: 0.5 }}>
      {rules.map(({ test, label }) => {
        const passed = password.length > 0 && test(password);
        return (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {password.length === 0 ? (
              <Close sx={{ fontSize: 16, color: 'text.disabled' }} />
            ) : passed ? (
              <Check sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <Close sx={{ fontSize: 16, color: 'error.main' }} />
            )}
            <Typography
              variant="caption"
              color={password.length === 0 ? 'text.secondary' : passed ? 'success.main' : 'error.main'}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
