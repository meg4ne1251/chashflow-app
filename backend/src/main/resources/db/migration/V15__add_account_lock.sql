-- ログイン失敗回数とアカウントロック用カラムを追加
ALTER TABLE users
    ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN locked_until TIMESTAMPTZ;

-- インデックス追加（ロック状態の確認を高速化）
CREATE INDEX idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

COMMENT ON COLUMN users.failed_attempts IS 'ログイン失敗回数（成功時にリセット）';
COMMENT ON COLUMN users.locked_until IS 'アカウントロック解除時刻（NULLの場合はロックなし）';
