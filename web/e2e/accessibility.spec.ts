import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('アクセシビリティ', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('ダッシュボードに重大なアクセシビリティ違反がない', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // critical/seriousな違反のみをチェック
    const violations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(violations).toEqual([]);
  });

  test('取引ページに重大なアクセシビリティ違反がない', async ({ page }) => {
    await page.goto('/transactions');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const violations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(violations).toEqual([]);
  });
});
