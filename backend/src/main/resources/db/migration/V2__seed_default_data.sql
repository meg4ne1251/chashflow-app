-- V2: Seed default categories and notification settings

-- Default expense categories
INSERT INTO categories (id, name, type, icon, color, sort_order, is_default) VALUES
    ('a0000000-0000-0000-0000-000000000001', '食費', 'expense', 'restaurant', '#FF5722', 1, true),
    ('a0000000-0000-0000-0000-000000000002', '日用品', 'expense', 'shopping_cart', '#795548', 2, true),
    ('a0000000-0000-0000-0000-000000000003', '交通費', 'expense', 'directions_car', '#2196F3', 3, true),
    ('a0000000-0000-0000-0000-000000000004', '娯楽・趣味', 'expense', 'sports_esports', '#9C27B0', 4, true),
    ('a0000000-0000-0000-0000-000000000005', '衣服・美容', 'expense', 'checkroom', '#E91E63', 5, true),
    ('a0000000-0000-0000-0000-000000000006', '医療・健康', 'expense', 'local_hospital', '#00BCD4', 6, true),
    ('a0000000-0000-0000-0000-000000000007', '教育・教養', 'expense', 'school', '#3F51B5', 7, true),
    ('a0000000-0000-0000-0000-000000000008', '住居費', 'expense', 'home', '#607D8B', 8, true),
    ('a0000000-0000-0000-0000-000000000009', '光熱費・通信費', 'expense', 'flash_on', '#FF9800', 9, true),
    ('a0000000-0000-0000-0000-00000000000a', '保険', 'expense', 'security', '#009688', 10, true),
    ('a0000000-0000-0000-0000-00000000000b', '税金・社会保険', 'expense', 'account_balance', '#4CAF50', 11, true),
    ('a0000000-0000-0000-0000-00000000000c', '交際費', 'expense', 'people', '#FFC107', 12, true),
    ('a0000000-0000-0000-0000-00000000000d', 'その他支出', 'expense', 'more_horiz', '#9E9E9E', 13, true);

-- Default income categories
INSERT INTO categories (id, name, type, icon, color, sort_order, is_default) VALUES
    ('b0000000-0000-0000-0000-000000000001', '給与', 'income', 'payments', '#4CAF50', 1, true),
    ('b0000000-0000-0000-0000-000000000002', '賞与', 'income', 'card_giftcard', '#8BC34A', 2, true),
    ('b0000000-0000-0000-0000-000000000003', '副業・フリーランス', 'income', 'work', '#CDDC39', 3, true),
    ('b0000000-0000-0000-0000-000000000004', '投資収益', 'income', 'trending_up', '#00BCD4', 4, true),
    ('b0000000-0000-0000-0000-000000000005', 'その他収入', 'income', 'more_horiz', '#9E9E9E', 5, true);

-- Default notification settings
INSERT INTO notification_settings (id, type, is_enabled, frequency, day_of_week, time_of_day, threshold_percent) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'input_remind', true, 'weekly', '6', '20:00', NULL),
    ('c0000000-0000-0000-0000-000000000002', 'budget_alert', true, NULL, NULL, NULL, 80);
