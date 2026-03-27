-- Add payment_day column to accounts table for credit card payment date tracking
ALTER TABLE accounts ADD COLUMN payment_day INTEGER;
ALTER TABLE accounts ADD CONSTRAINT accounts_payment_day_range CHECK (payment_day BETWEEN 1 AND 31);

-- Seed notification setting for credit card payment reminders
INSERT INTO notification_settings VALUES
    ('c0000000-0000-0000-0000-000000000003', 'credit_card_payment', true, NULL, NULL, NULL, NULL, 1, NOW(), NOW(), NULL);
