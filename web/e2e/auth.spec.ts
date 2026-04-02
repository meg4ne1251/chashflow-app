import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { TEST_USER } from './fixtures/test-data';

test.describe('認証', () => {
  test('正しい資格情報でログインできる', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USER.username, TEST_USER.password);

    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('誤った資格情報でエラーが表示される', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wronguser', 'WrongPass1!');

    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('ログアウトできる', async ({ page }) => {
    // 認証済み状態でスタート
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USER.username, TEST_USER.password);
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    
    // アカウントメニューを開く（アイコンボタンをクリック）
    await page.getByRole('button', { name: /アカウント/i }).click();
    await page.getByRole('menuitem', { name: /ログアウト/i }).click();

    await expect(page).toHaveURL(/login/);
  });
});
