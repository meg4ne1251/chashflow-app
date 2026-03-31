import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Paper, TextField, Button, Stack, Alert,
  Snackbar, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControl, InputLabel, Select, MenuItem,
  RadioGroup, FormControlLabel, Radio, Switch,
} from '@mui/material';
import {
  FileUpload, FileDownload, Backup, CloudDownload, VpnKey, PictureAsPdf,
  Notifications,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodFormResolver } from '@/validation/resolver';
import { passwordChangeSchema, type PasswordChangeFormData } from '@/validation/schemas';
import { authApi } from '@/api/auth';
import { importExportApi, notificationSettingApi } from '@/api/importExport';
import { downloadBlob } from '@/utils/format';
import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/constants';
import { useMobile } from '@/hooks/useMobile';
import type { ImportResultResponse } from '@/types';

export default function SettingsPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('merge');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupWarningOpen, setBackupWarningOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Password Change ===
  const pwForm = useForm<PasswordChangeFormData>({ resolver: zodFormResolver(passwordChangeSchema) });
  const pwMutation = useMutation({
    mutationFn: (data: PasswordChangeFormData) => authApi.changePassword({ current_password: data.current_password, new_password: data.new_password }),
    onSuccess: () => {
      // パスワード変更後、サーバー側でCookieが削除されるのでログイン画面にリダイレクト
      window.location.href = '/login';
    },
    onError: () => setError('パスワードの変更に失敗しました。現在のパスワードを確認してください。'),
  });

  // PDF export state
  const [pdfType, setPdfType] = useState<'monthly' | 'yearly'>('monthly');
  const [pdfYearMonth, setPdfYearMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pdfYear, setPdfYear] = useState(new Date().getFullYear());

  // === Import/Export ===
  const exportMutation = useMutation({
    mutationFn: () => importExportApi.exportCsv(),
    onSuccess: (resp) => {
      const blob = new Blob([resp.data], { type: 'text/csv' });
      downloadBlob(blob, `kakeibo_export_${new Date().toISOString().slice(0, 10)}.csv`);
      setSnackMsg('CSVをエクスポートしました');
    },
    onError: () => setError('エクスポートに失敗しました'),
  });

  const pdfMutation = useMutation({
    mutationFn: () => importExportApi.exportPdf(
      pdfType,
      pdfType === 'monthly' ? pdfYearMonth : undefined,
      pdfType === 'yearly' ? pdfYear : undefined,
    ),
    onSuccess: (resp) => {
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const suffix = pdfType === 'monthly' ? pdfYearMonth : String(pdfYear);
      downloadBlob(blob, `kakeibo_report_${suffix}.pdf`);
      setSnackMsg('PDFレポートをエクスポートしました');
    },
    onError: () => setError('PDFレポートのエクスポートに失敗しました'),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importExportApi.importCsv(file),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const result = resp.data as ImportResultResponse;
      setSnackMsg(`インポート完了: ${result.imported_count}件`);
    },
    onError: () => setError('インポートに失敗しました。ファイル形式を確認してください。'),
  });

  const backupMutation = useMutation({
    mutationFn: () => importExportApi.backup(),
    onSuccess: (resp) => {
      const blob = resp.data instanceof Blob ? resp.data : new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json`);
      setSnackMsg('バックアップを作成しました');
      setBackupWarningOpen(true);
    },
    onError: () => setError('バックアップの作成に失敗しました'),
  });

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const restoreMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: 'overwrite' | 'merge' }) => {
      return importExportApi.restore(file, mode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSnackMsg('バックアップを復元しました');
      setRestoreDialogOpen(false);
    },
    onError: () => setError('バックアップの復元に失敗しました'),
  });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setError('ファイルサイズが上限（10MB）を超えています');
      return;
    }
    if (!file.name.endsWith('.csv')) {
      setError('対応形式は .csv のみです');
      return;
    }
    importMutation.mutate(file);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.json')) {
      setError('バックアップファイルは .json 形式である必要があります');
      return;
    }
    setRestoreFile(file);
    setRestoreDialogOpen(true);
  };

  const handleRestoreConfirm = () => {
    if (restoreFile) {
      restoreMutation.mutate({ file: restoreFile, mode: restoreMode });
    }
  };

  // === Notification Settings ===
  const { data: notifSettings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => notificationSettingApi.list(),
    select: (res) => res.data,
  });

  const notifMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof notificationSettingApi.update>[1] }) =>
      notificationSettingApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      setSnackMsg('通知設定を更新しました');
    },
    onError: () => setError('通知設定の更新に失敗しました'),
  });

  return (
    <Box>
      {!isMobile && <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>設定</Typography>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Password Change */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <VpnKey color="primary" />
          <Typography variant="h6">パスワード変更</Typography>
        </Box>
        <Box component="form" onSubmit={pwForm.handleSubmit((data) => { setError(null); pwMutation.mutate(data); })} noValidate>
          <Stack spacing={2} sx={{ maxWidth: 400 }}>
            <TextField
              fullWidth label="現在のパスワード" type="password"
              {...pwForm.register('current_password')}
              error={!!pwForm.formState.errors.current_password}
              helperText={pwForm.formState.errors.current_password?.message}
            />
            <TextField
              fullWidth label="新しいパスワード" type="password"
              {...pwForm.register('new_password')}
              error={!!pwForm.formState.errors.new_password}
              helperText={pwForm.formState.errors.new_password?.message}
            />
            <TextField
              fullWidth label="新しいパスワード（確認）" type="password"
              {...pwForm.register('confirm_password')}
              error={!!pwForm.formState.errors.confirm_password}
              helperText={pwForm.formState.errors.confirm_password?.message}
            />
            <Button type="submit" variant="contained" disabled={pwMutation.isPending} sx={{ alignSelf: 'flex-start' }}>
              {pwMutation.isPending ? <CircularProgress size={20} /> : 'パスワードを変更'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Import/Export */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FileDownload color="primary" />
          <Typography variant="h6">インポート / エクスポート</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="outlined"
            startIcon={exportMutation.isPending ? <CircularProgress size={18} /> : <FileDownload />}
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            CSVエクスポート
          </Button>
          <Button
            variant="outlined"
            startIcon={importMutation.isPending ? <CircularProgress size={18} /> : <FileUpload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            CSVインポート
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          対応形式: .csv（ファイルサイズ上限: 10MB、最大行数: 10,000行）
        </Typography>
      </Paper>

      {/* PDF Export */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PictureAsPdf color="primary" />
          <Typography variant="h6">PDFレポート</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>種類</InputLabel>
            <Select value={pdfType} onChange={(e) => setPdfType(e.target.value as 'monthly' | 'yearly')} label="種類">
              <MenuItem value="monthly">月次</MenuItem>
              <MenuItem value="yearly">年次</MenuItem>
            </Select>
          </FormControl>
          {pdfType === 'monthly' ? (
            <TextField label="年月" type="month" size="small" value={pdfYearMonth} onChange={(e) => setPdfYearMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
          ) : (
            <TextField label="年" type="number" size="small" value={pdfYear} onChange={(e) => setPdfYear(Number(e.target.value))} inputProps={{ min: 2000, max: 2100 }} sx={{ width: 120 }} />
          )}
          <Button
            variant="outlined"
            startIcon={pdfMutation.isPending ? <CircularProgress size={18} /> : <PictureAsPdf />}
            onClick={() => pdfMutation.mutate()}
            disabled={pdfMutation.isPending}
          >
            PDFエクスポート
          </Button>
        </Stack>
      </Paper>

      {/* Backup/Restore */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Backup color="primary" />
          <Typography variant="h6">バックアップ / 復元</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="outlined"
            startIcon={backupMutation.isPending ? <CircularProgress size={18} /> : <Backup />}
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
          >
            バックアップ作成
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={restoreMutation.isPending ? <CircularProgress size={18} /> : <CloudDownload />}
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoreMutation.isPending}
          >
            バックアップ復元
          </Button>
          <input ref={restoreInputRef} type="file" accept=".json" hidden onChange={handleRestoreFile} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          バックアップはJSON形式で全データを含みます。復元時に上書きまたはマージを選択できます。
        </Typography>
      </Paper>

      {/* Restore Mode Selection Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>バックアップの復元</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            復元モードを選択してください。
          </Typography>
          <RadioGroup value={restoreMode} onChange={(e) => setRestoreMode(e.target.value as 'overwrite' | 'merge')}>
            <FormControlLabel
              value="merge"
              control={<Radio />}
              label={
                <Box>
                  <Typography fontWeight={600}>マージ（推奨）</Typography>
                  <Typography variant="caption" color="text.secondary">
                    IDが一致するレコードは新しい方を採用。新規レコードは追加されます。
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="overwrite"
              control={<Radio />}
              label={
                <Box>
                  <Typography fontWeight={600}>上書き</Typography>
                  <Typography variant="caption" color="text.secondary">
                    既存データを全削除してから復元します。Undo履歴もクリアされます。
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
          {restoreMode === 'overwrite' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              上書きモードでは既存の全データが削除されます。この操作は元に戻せません。
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            color={restoreMode === 'overwrite' ? 'error' : 'primary'}
            onClick={handleRestoreConfirm}
            disabled={restoreMutation.isPending}
          >
            {restoreMutation.isPending ? <CircularProgress size={20} /> : '復元する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Settings */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Notifications color="primary" />
          <Typography variant="h6">通知設定</Typography>
        </Box>
        {notifSettings?.map((setting) => (
          <Paper key={setting.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography fontWeight={600}>
                {setting.type === 'input_remind' ? '入力リマインダー' : setting.type === 'credit_card_payment' ? 'クレジットカード引落しリマインダー' : '予算アラート'}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={setting.is_enabled}
                    onChange={(e) =>
                      notifMutation.mutate({ id: setting.id, data: { is_enabled: e.target.checked, version: setting.version } })
                    }
                  />
                }
                label={setting.is_enabled ? 'ON' : 'OFF'}
              />
            </Stack>
            {setting.type === 'input_remind' && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>頻度</InputLabel>
                  <Select
                    value={setting.frequency || 'daily'}
                    label="頻度"
                    onChange={(e) =>
                      notifMutation.mutate({
                        id: setting.id,
                        data: { frequency: e.target.value as 'daily' | 'weekly' | 'biweekly' | 'custom', version: setting.version },
                      })
                    }
                  >
                    <MenuItem value="daily">毎日</MenuItem>
                    <MenuItem value="weekly">毎週</MenuItem>
                    <MenuItem value="biweekly">隔週</MenuItem>
                    <MenuItem value="custom">カスタム</MenuItem>
                  </Select>
                </FormControl>
                {(setting.frequency === 'weekly' || setting.frequency === 'biweekly') && (
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>曜日</InputLabel>
                    <Select
                      value={setting.day_of_week || 'monday'}
                      label="曜日"
                      onChange={(e) =>
                        notifMutation.mutate({ id: setting.id, data: { day_of_week: e.target.value, version: setting.version } })
                      }
                    >
                      <MenuItem value="monday">月曜</MenuItem>
                      <MenuItem value="tuesday">火曜</MenuItem>
                      <MenuItem value="wednesday">水曜</MenuItem>
                      <MenuItem value="thursday">木曜</MenuItem>
                      <MenuItem value="friday">金曜</MenuItem>
                      <MenuItem value="saturday">土曜</MenuItem>
                      <MenuItem value="sunday">日曜</MenuItem>
                    </Select>
                  </FormControl>
                )}
                <TextField
                  size="small"
                  type="time"
                  label="通知時刻"
                  value={setting.time_of_day || '21:00'}
                  onChange={(e) =>
                    notifMutation.mutate({ id: setting.id, data: { time_of_day: e.target.value, version: setting.version } })
                  }
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 130 }}
                />
              </Stack>
            )}
            {setting.type === 'budget_alert' && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  type="number"
                  label="アラート閾値 (%)"
                  value={setting.threshold_percent ?? 80}
                  onChange={(e) =>
                    notifMutation.mutate({
                      id: setting.id,
                      data: { threshold_percent: Number(e.target.value), version: setting.version },
                    })
                  }
                  inputProps={{ min: 1, max: 100 }}
                  sx={{ width: 150 }}
                />
                <Typography variant="body2" color="text.secondary">
                  予算の使用率がこの値を超えた場合にアラートを表示します。
                </Typography>
              </Stack>
            )}
            {setting.type === 'credit_card_payment' && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                各クレジットカードに設定された引落し日の3日前に通知します。引落し日は決済手段管理で設定できます。
              </Typography>
            )}
          </Paper>
        ))}
      </Paper>

      {/* Backup Security Warning Dialog */}
      <Dialog open={backupWarningOpen} onClose={() => setBackupWarningOpen(false)}>
        <DialogTitle>バックアップの取り扱いについて</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            このファイルには財務情報が含まれます。安全な場所に保管し、第三者と共有しないでください。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setBackupWarningOpen(false)}>理解しました</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snackMsg} autoHideDuration={3000} onClose={() => setSnackMsg(null)} message={snackMsg} sx={isMobile ? { bottom: 72 } : undefined} />
    </Box>
  );
}
