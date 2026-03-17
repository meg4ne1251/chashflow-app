-- Change transactions.date from DATE to TIMESTAMP to support time (hours/minutes)
-- Existing DATE values are cast to TIMESTAMP at midnight (00:00:00)
ALTER TABLE transactions ALTER COLUMN date TYPE TIMESTAMP USING date::TIMESTAMP;
