import { useMediaQuery, useTheme } from '@mui/material';

/**
 * モバイル判定フック
 *
 * MUIテーマのブレークポイント 'md' 未満の場合にtrueを返します。
 * レスポンシブレイアウトでモバイル/デスクトップの分岐に使用します。
 *
 * @returns モバイル幅ならtrue
 */
export function useMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}
