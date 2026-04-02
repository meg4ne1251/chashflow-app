import { Page, Locator } from '@playwright/test';

export class TransactionPage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly amountInput: Locator;
  readonly categorySelect: Locator;
  readonly accountSelect: Locator;
  readonly memoInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: /新規|追加/i });
    this.amountInput = page.getByLabel(/金額/i);
    this.categorySelect = page.getByLabel(/カテゴリ/i);
    this.accountSelect = page.getByLabel(/決済手段|口座/i);
    this.memoInput = page.getByLabel(/メモ/i);
    this.saveButton = page.getByRole('button', { name: /保存/i });
  }

  async goto() {
    await this.page.goto('/transactions');
  }

  async gotoNew() {
    await this.page.goto('/transactions/new');
  }

  async createTransaction(data: {
    amount: number;
    category?: string;
    account?: string;
    memo?: string;
  }) {
    await this.amountInput.fill(String(data.amount));
    if (data.category) {
      await this.categorySelect.click();
      await this.page.getByRole('option', { name: data.category }).click();
    }
    if (data.account) {
      await this.accountSelect.click();
      await this.page.getByRole('option', { name: data.account }).click();
    }
    if (data.memo) {
      await this.memoInput.fill(data.memo);
    }
    await this.saveButton.click();
  }
}
