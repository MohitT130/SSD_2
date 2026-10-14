-- ============================================================
-- Team 26 (Assignment 2) additions for the Browse, Transaction
-- and Audit screens. Run after 01-05. Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Move an order through its lifecycle:
--      PREPARING -> DELIVERING -> DELIVERED
--
-- Needed so the UI can demonstrate the partial unique index
-- idx_active_user_order: a user's second order is blocked while
-- the first is PREPARING/DELIVERING and allowed once it is
-- DELIVERED.
--
-- Usage:  CALL sp_advance_order_status('<order uuid>');
-- Returns previous_status and new_status as the CALL result row.
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_advance_order_status(UUID, TEXT, TEXT);

CREATE OR REPLACE PROCEDURE sp_advance_order_status(
    p_order_id UUID,
    INOUT previous_status TEXT DEFAULT NULL,
    INOUT new_status TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Lock the order so two clicks cannot advance it twice.
    SELECT status
    INTO previous_status
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order does not exist'
            USING ERRCODE = 'no_data_found';
    END IF;

    new_status := CASE previous_status
        WHEN 'PREPARING'  THEN 'DELIVERING'
        WHEN 'DELIVERING' THEN 'DELIVERED'
    END;

    IF new_status IS NULL THEN
        RAISE EXCEPTION 'Order is already delivered'
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    UPDATE orders
    SET status = new_status
    WHERE id = p_order_id;
END;
$$;


-- ------------------------------------------------------------
-- 2. Index for the Audit screen.
--
-- The audit trail is always read for one user, newest first.
-- Without this index the query scans all ~120,000 rows.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wallet_audit_user_ts
ON wallet_audit_logs (user_id, timestamp DESC);


-- ------------------------------------------------------------
-- 3. Index for Browse: newest orders of one status
--    (e.g. "all PREPARING orders", newest first).
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
ON orders (status, created_at DESC);
