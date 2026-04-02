import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // シーケンシャル実行（DBステート依存）
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // 並列実行しない
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // モバイルテスト
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  // フロントエンド + バックエンドの両方を起動
  webServer: [
    {
      command: 'cd .. && ./gradlew :backend:run',
      url: 'http://localhost:8080/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,  // Gradle起動は時間がかかる
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
  globalSetup: './e2e/global-setup.ts',
});
