-- Add optional name column to transactions and recurring_transactions
ALTER TABLE transactions ADD COLUMN name VARCHAR(100);
ALTER TABLE recurring_transactions ADD COLUMN name VARCHAR(100);
