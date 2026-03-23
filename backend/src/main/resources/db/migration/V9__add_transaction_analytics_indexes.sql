-- Composite indexes for analytics queries (SUM/GROUP BY on type + date range + soft delete filter)
CREATE INDEX idx_transactions_type_date ON transactions(type, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_type_category_date ON transactions(type, category_id, date) WHERE deleted_at IS NULL;
