import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_USER = {
  username: 'e2e-testuser',
  password: 'E2eTestPass1!',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:5173';
  const apiURL = 'http://localhost:8080';

  // 認証状態保存用ディレクトリを作成
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // ヘルスチェック
  const healthRes = await fetch(`${apiURL}/api/v1/health`);
  if (!healthRes.ok) {
    throw new Error('Backend not ready');
  }

  // 初期セットアップ（ユーザー未作成の場合のみ）
  const setupRes = await fetch(`${apiURL}/api/v1/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  
  // 409 Conflictは既にセットアップ済み = OK
  if (!setupRes.ok && setupRes.status !== 409) {
    throw new Error(`Setup failed: ${setupRes.status}`);
  }

  // ストレージステートを保存（認証済み状態）
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  
  await page.getByLabel(/ユーザー名/i).fill(TEST_USER.username);
  await page.getByLabel(/パスワード/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /ログイン/i }).click();
  
  // ダッシュボードまたはルートにリダイレクト
  await page.waitForURL(/\/(dashboard)?$/);
  
  // 認証状態を保存
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}

export default globalSetup;
