-- V1: Initial schema for Kakeibo (家計簿) application
-- All tables use UUID primary keys, version-based optimistic locking,
-- and logical deletion via deleted_at timestamps.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

---------------------------------------------------
-- 3.15 users
---------------------------------------------------
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50)     NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

---------------------------------------------------
-- 3.16 refresh_tokens
---------------------------------------------------
CREATE TABLE refresh_tokens (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64)     NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

---------------------------------------------------
-- 3.1 accounts
---------------------------------------------------
CREATE TABLE accounts (
    id              UUID            PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    type            VARCHAR(20)     NOT NULL CHECK (type IN ('cash', 'bank', 'credit_card', 'e_money', 'other')),
    initial_balance BIGINT          NOT NULL DEFAULT 0,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'JPY',
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_accounts_name_unique ON accounts(name) WHERE deleted_at IS NULL;

---------------------------------------------------
-- 3.2 categories
---------------------------------------------------
CREATE TABLE categories (
    id              UUID            PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL,
    type            VARCHAR(10)     NOT NULL CHECK (type IN ('income', 'expense')),
    icon            VARCHAR(50),
    color           VARCHAR(7),
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    is_default      BOOLEAN         NOT NULL DEFAULT false,
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_categories_name_type_unique ON categories(name, type) WHERE deleted_at IS NULL;

---------------------------------------------------
-- 3.3 tags
---------------------------------------------------
CREATE TABLE tags (
    id              UUID            PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL,
    color           VARCHAR(7),
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_tags_name_unique ON tags(name) WHERE deleted_at IS NULL;

---------------------------------------------------
-- 3.8 recurring_transactions
---------------------------------------------------
CREATE TABLE recurring_transactions (
    id                      UUID            PRIMARY KEY,
    type                    VARCHAR(10)     NOT NULL CHECK (type IN ('income', 'expense')),
    amount                  BIGINT          NOT NULL CHECK (amount > 0),
    currency                VARCHAR(3)      NOT NULL DEFAULT 'JPY',
    category_id             UUID            NOT NULL REFERENCES categories(id),
    account_id              UUID            NOT NULL REFERENCES accounts(id),
    frequency               VARCHAR(10)     NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    "interval"              INTEGER         NOT NULL DEFAULT 1,
    day_of_month            INTEGER         CHECK (day_of_month BETWEEN 1 AND 31),
    day_of_week             INTEGER         CHECK (day_of_week BETWEEN 0 AND 6),
    month_of_year           INTEGER         CHECK (month_of_year BETWEEN 1 AND 12),
    start_date              DATE            NOT NULL,
    end_date                DATE,
    next_execution_date     DATE            NOT NULL,
    memo                    TEXT,
    is_active               BOOLEAN         NOT NULL DEFAULT true,
    version                 INTEGER         NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);
CREATE INDEX idx_recurring_active_next ON recurring_transactions(is_active, next_execution_date);

---------------------------------------------------
-- 3.4 transactions
---------------------------------------------------
CREATE TABLE transactions (
    id                          UUID            PRIMARY KEY,
    type                        VARCHAR(10)     NOT NULL CHECK (type IN ('income', 'expense')),
    amount                      BIGINT          NOT NULL CHECK (amount > 0),
    currency                    VARCHAR(3)      NOT NULL DEFAULT 'JPY',
    date                        DATE            NOT NULL,
    memo                        TEXT,
    category_id                 UUID            NOT NULL REFERENCES categories(id),
    account_id                  UUID            NOT NULL REFERENCES accounts(id),
    is_auto_generated           BOOLEAN         NOT NULL DEFAULT false,
    recurring_transaction_id    UUID            REFERENCES recurring_transactions(id),
    version                     INTEGER         NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category_date ON transactions(category_id, date);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, date);
CREATE INDEX idx_transactions_deleted ON transactions(deleted_at);
CREATE INDEX idx_transactions_memo_gin ON transactions USING gin(memo gin_trgm_ops);

---------------------------------------------------
-- 3.5 transaction_tags
---------------------------------------------------
CREATE TABLE transaction_tags (
    transaction_id  UUID    NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id          UUID    NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

---------------------------------------------------
-- 3.6 transaction_history
---------------------------------------------------
CREATE TABLE transaction_history (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id      UUID            NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id             UUID            NOT NULL REFERENCES users(id),
    changed_fields      JSONB           NOT NULL,
    changed_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    version_before      INTEGER         NOT NULL,
    version_after       INTEGER         NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tx_history_tx_changed ON transaction_history(transaction_id, changed_at DESC);

---------------------------------------------------
-- 3.7 transfers
---------------------------------------------------
CREATE TABLE transfers (
    id                  UUID            PRIMARY KEY,
    from_account_id     UUID            NOT NULL REFERENCES accounts(id),
    to_account_id       UUID            NOT NULL REFERENCES accounts(id),
    amount              BIGINT          NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3)      NOT NULL DEFAULT 'JPY',
    date                DATE            NOT NULL,
    memo                TEXT,
    version             INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_transfer_different_accounts CHECK (from_account_id != to_account_id)
);

---------------------------------------------------
-- 3.9 recurring_transaction_tags
---------------------------------------------------
CREATE TABLE recurring_transaction_tags (
    recurring_transaction_id    UUID    NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    tag_id                      UUID    NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recurring_transaction_id, tag_id)
);

---------------------------------------------------
-- 3.10 budgets
---------------------------------------------------
CREATE TABLE budgets (
    id              UUID            PRIMARY KEY,
    category_id     UUID            NOT NULL REFERENCES categories(id),
    year_month      VARCHAR(7)      NOT NULL,
    amount          BIGINT          NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3)      NOT NULL DEFAULT 'JPY',
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_budgets_category_month_unique ON budgets(category_id, year_month) WHERE deleted_at IS NULL;

---------------------------------------------------
-- 3.11 templates
---------------------------------------------------
CREATE TABLE templates (
    id              UUID            PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    type            VARCHAR(10)     NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense')),
    amount          BIGINT,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'JPY',
    category_id     UUID            REFERENCES categories(id),
    account_id      UUID            REFERENCES accounts(id),
    memo            TEXT,
    use_count       INTEGER         NOT NULL DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

---------------------------------------------------
-- 3.12 template_tags
---------------------------------------------------
CREATE TABLE template_tags (
    template_id     UUID    NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    tag_id          UUID    NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, tag_id)
);

---------------------------------------------------
-- 3.13 input_patterns
---------------------------------------------------
CREATE TABLE input_patterns (
    id              UUID            PRIMARY KEY,
    keyword         VARCHAR(200)    NOT NULL,
    category_id     UUID            REFERENCES categories(id),
    account_id      UUID            REFERENCES accounts(id),
    hit_count       INTEGER         NOT NULL DEFAULT 1,
    last_used_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_input_patterns_keyword_unique ON input_patterns(keyword) WHERE deleted_at IS NULL;
CREATE INDEX idx_input_patterns_keyword ON input_patterns(keyword);

---------------------------------------------------
-- 3.14 notification_settings
---------------------------------------------------
CREATE TABLE notification_settings (
    id                  UUID            PRIMARY KEY,
    type                VARCHAR(30)     NOT NULL,
    is_enabled          BOOLEAN         NOT NULL DEFAULT true,
    frequency           VARCHAR(20),
    day_of_week         VARCHAR(20),
    time_of_day         TIME,
    threshold_percent   INTEGER         CHECK (threshold_percent BETWEEN 1 AND 100),
    version             INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_notification_type_unique ON notification_settings(type) WHERE deleted_at IS NULL;
