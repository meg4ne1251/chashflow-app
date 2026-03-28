-- Add 'savings' to the accounts type CHECK constraint
ALTER TABLE accounts DROP CONSTRAINT accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('cash', 'bank', 'credit_card', 'e_money', 'other', 'savings'));

-- Create savings accounts for existing savings goals that don't have an account_id
DO $$
DECLARE
    goal RECORD;
    new_account_id UUID;
BEGIN
    FOR goal IN
        SELECT id, name, current_amount, currency
        FROM savings_goals
        WHERE deleted_at IS NULL AND account_id IS NULL
    LOOP
        new_account_id := gen_random_uuid();

        INSERT INTO accounts (id, name, type, initial_balance, currency, sort_order, version, created_at, updated_at)
        VALUES (new_account_id, '【貯蓄】' || goal.name, 'savings', goal.current_amount, goal.currency, 9999, 1, now(), now());

        UPDATE savings_goals
        SET account_id = new_account_id, updated_at = now()
        WHERE id = goal.id;
    END LOOP;
END $$;
