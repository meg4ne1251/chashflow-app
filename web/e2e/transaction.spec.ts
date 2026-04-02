import { test, expect } from '@playwright/test';
import { TransactionPage } from './pages/transaction.page';

test.describe('取引', () => {
  // 認証済み状態を使用
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('取引一覧が表示される', async ({ page }) => {
    const txPage = new TransactionPage(page);
    await txPage.goto();

    await expect(page.getByText(/取引|明細/i)).toBeVisible();
  });

  test('新規取引画面に遷移できる', async ({ page }) => {
    const txPage = new TransactionPage(page);
    await txPage.goto();

    // 新規ボタンをクリック
    await txPage.addButton.click();
    
    await expect(page).toHaveURL(/transactions\/new/);
  });

  test('取引タイプを選択できる', async ({ page }) => {
    const txPage = new TransactionPage(page);
    await txPage.gotoNew();

    // タイプ選択（支出）
    const expenseButton = page.getByRole('button', { name: /支出/i });
    await expect(expenseButton).toBeVisible();
  });
});
