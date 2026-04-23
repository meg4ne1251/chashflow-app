-- Add configurable "days before payment" setting for credit card payment reminder
ALTER TABLE notification_settings
    ADD COLUMN reminder_days_before INTEGER CHECK (reminder_days_before BETWEEN 0 AND 31);

-- Initialize existing credit_card_payment setting with the previous hard-coded value (3 days)
UPDATE notification_settings
SET reminder_days_before = 3
WHERE type = 'credit_card_payment';

-- Seed notification setting for post-payment transfer reminder
-- 引き落とし日を過ぎたら、銀行口座→クレジットカードの振替記録を促す通知
INSERT INTO notification_settings (id, type, is_enabled, version, created_at, updated_at)
VALUES ('c0000000-0000-0000-0000-000000000005', 'credit_card_transfer', true, 1, NOW(), NOW());

COMMENT ON COLUMN notification_settings.reminder_days_before IS 'クレジットカード引落し日の何日前に通知するか（credit_card_payment タイプで使用）';
