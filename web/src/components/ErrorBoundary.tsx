import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Paper, Stack, Collapse } from '@mui/material';
import { Refresh, Home, ExpandMore, ExpandLess } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
            bgcolor: 'background.default',
          }}
          role="alert"
        >
          <Paper sx={{ p: 4, maxWidth: 560, width: '100%', textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom color="error">
              予期しないエラーが発生しました
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              アプリケーションでエラーが発生しました。
              再試行するか、ホームに戻ってください。
            </Typography>

            {error?.message && (
              <Typography
                variant="body2"
                sx={{
                  mb: 3,
                  p: 1.5,
                  bgcolor: 'error.light',
                  color: 'error.contrastText',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                }}
              >
                {error.message}
              </Typography>
            )}

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={this.handleRetry}
              >
                再試行
              </Button>
              <Button
                variant="outlined"
                startIcon={<Home />}
                onClick={this.handleGoHome}
              >
                ホームに戻る
              </Button>
            </Stack>

            {errorInfo && (
              <>
                <Button
                  size="small"
                  onClick={this.toggleDetails}
                  endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                  sx={{ textTransform: 'none' }}
                >
                  技術的な詳細を{showDetails ? '隠す' : '表示'}
                </Button>
                <Collapse in={showDetails}>
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: 'grey.100',
                      borderRadius: 1,
                      textAlign: 'left',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                    >
                      {errorInfo.componentStack}
                    </Typography>
                  </Box>
                </Collapse>
              </>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
