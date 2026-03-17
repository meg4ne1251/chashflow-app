-- V5: Ensure default categories have icons set
-- Covers cases where the database was seeded before icons were added

UPDATE categories SET icon = 'restaurant'     WHERE id = 'a0000000-0000-0000-0000-000000000001' AND icon IS NULL;
UPDATE categories SET icon = 'shopping_cart'   WHERE id = 'a0000000-0000-0000-0000-000000000002' AND icon IS NULL;
UPDATE categories SET icon = 'directions_car'  WHERE id = 'a0000000-0000-0000-0000-000000000003' AND icon IS NULL;
UPDATE categories SET icon = 'sports_esports'  WHERE id = 'a0000000-0000-0000-0000-000000000004' AND icon IS NULL;
UPDATE categories SET icon = 'checkroom'       WHERE id = 'a0000000-0000-0000-0000-000000000005' AND icon IS NULL;
UPDATE categories SET icon = 'local_hospital'  WHERE id = 'a0000000-0000-0000-0000-000000000006' AND icon IS NULL;
UPDATE categories SET icon = 'school'          WHERE id = 'a0000000-0000-0000-0000-000000000007' AND icon IS NULL;
UPDATE categories SET icon = 'home'            WHERE id = 'a0000000-0000-0000-0000-000000000008' AND icon IS NULL;
UPDATE categories SET icon = 'flash_on'        WHERE id = 'a0000000-0000-0000-0000-000000000009' AND icon IS NULL;
UPDATE categories SET icon = 'security'        WHERE id = 'a0000000-0000-0000-0000-00000000000a' AND icon IS NULL;
UPDATE categories SET icon = 'account_balance' WHERE id = 'a0000000-0000-0000-0000-00000000000b' AND icon IS NULL;
UPDATE categories SET icon = 'people'          WHERE id = 'a0000000-0000-0000-0000-00000000000c' AND icon IS NULL;
UPDATE categories SET icon = 'more_horiz'      WHERE id = 'a0000000-0000-0000-0000-00000000000d' AND icon IS NULL;

UPDATE categories SET icon = 'payments'        WHERE id = 'b0000000-0000-0000-0000-000000000001' AND icon IS NULL;
UPDATE categories SET icon = 'card_giftcard'   WHERE id = 'b0000000-0000-0000-0000-000000000002' AND icon IS NULL;
UPDATE categories SET icon = 'work'            WHERE id = 'b0000000-0000-0000-0000-000000000003' AND icon IS NULL;
UPDATE categories SET icon = 'trending_up'     WHERE id = 'b0000000-0000-0000-0000-000000000004' AND icon IS NULL;
UPDATE categories SET icon = 'more_horiz'      WHERE id = 'b0000000-0000-0000-0000-000000000005' AND icon IS NULL;
