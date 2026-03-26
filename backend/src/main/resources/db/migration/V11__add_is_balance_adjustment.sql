-- Add is_balance_adjustment flag to transactions
ALTER TABLE transactions ADD COLUMN is_balance_adjustment BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing balance adjustment transactions (identified by memo = '残高調整')
UPDATE transactions SET is_balance_adjustment = true WHERE memo = '残高調整';

-- Index for efficient filtering in aggregation queries
CREATE INDEX idx_transactions_balance_adjustment ON transactions (is_balance_adjustment) WHERE is_balance_adjustment = true;
