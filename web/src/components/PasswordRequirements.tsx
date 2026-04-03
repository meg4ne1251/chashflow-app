import { Box, Typography, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Check, Close } from '@mui/icons-material';

interface PasswordRequirementsProps {
  password: string;
}

const requirements = [
  { test: (p: string) => p.length >= 12, label: '12文字以上' },
  { test: (p: string) => /[A-Z]/.test(p), label: '英大文字を含む' },
  { test: (p: string) => /[a-z]/.test(p), label: '英小文字を含む' },
  { test: (p: string) => /\d/.test(p), label: '数字を含む' },
  { test: (p: string) => /[@#$%^&+=!*?]/.test(p), label: '記号(@#$%^&+=!*?)を含む' },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Typography variant="caption" color="text.secondary">
        パスワード要件:
      </Typography>
      <List dense disablePadding>
        {requirements.map((req, idx) => {
          const met = password.length > 0 && req.test(password);
          return (
            <ListItem key={idx} disablePadding sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                {met ? (
                  <Check fontSize="small" color="success" />
                ) : (
                  <Close fontSize="small" color={password.length > 0 ? 'error' : 'disabled'} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={req.label}
                primaryTypographyProps={{
                  variant: 'caption',
                  color: met ? 'success.main' : password.length > 0 ? 'error.main' : 'text.secondary',
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
