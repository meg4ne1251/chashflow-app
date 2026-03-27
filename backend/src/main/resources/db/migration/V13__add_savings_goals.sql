-- Savings Goals table
CREATE TABLE savings_goals (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_amount BIGINT NOT NULL CHECK (target_amount > 0),
    current_amount BIGINT NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'JPY',
    deadline DATE,
    account_id UUID REFERENCES accounts(id),
    icon VARCHAR(50),
    color VARCHAR(7),
    sort_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'cancelled')),
    achieved_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_savings_goals_status ON savings_goals(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_savings_goals_deadline ON savings_goals(deadline) WHERE deleted_at IS NULL AND status = 'active';

-- Notification setting for savings goal achievement
INSERT INTO notification_settings (id, type, is_enabled, version, created_at, updated_at)
VALUES ('d0000000-0000-0000-0000-000000000004', 'savings_goal_achieved', true, 1, now(), now());
