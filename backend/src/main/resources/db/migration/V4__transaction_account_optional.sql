-- Make account_id optional for transactions
ALTER TABLE transactions
    ALTER COLUMN account_id DROP NOT NULL;
