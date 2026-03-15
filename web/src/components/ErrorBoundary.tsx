import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 480, textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              予期しないエラーが発生しました
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              アプリケーションでエラーが発生しました。ページを再読み込みしてください。
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
            >
              ホームに戻る
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
