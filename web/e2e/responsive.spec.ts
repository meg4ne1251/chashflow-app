import { test, expect, devices } from '@playwright/test';

test.describe('レスポンシブ対応', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('モバイルでボトムナビゲーションが表示される', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 13'].viewport);
    await page.goto('/');

    // モバイルナビゲーション確認（BottomNavigation）
    const bottomNav = page.locator('[role="navigation"]');
    await expect(bottomNav).toBeVisible();
  });

  test('デスクトップでサイドバーが表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // サイドバー/ドロワー確認
    const sidebar = page.locator('nav, [role="navigation"]');
    await expect(sidebar.first()).toBeVisible();
  });
});
