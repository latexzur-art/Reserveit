-- =====================================================
-- Sentinel-based permanent delete for users
-- =====================================================
-- Replaces the prior cascade-delete approach. Permanent delete
-- preserves the user's bookings/payments/uploads/etc. by
-- reassigning RESTRICT/NO ACTION FKs to a sentinel `[Deleted User]`
-- row instead of deleting the dependent rows.
--
-- CASCADE FKs (user_roles, messages, notifications, etc.) and
-- SET NULL FKs are still handled by the DB engine on the final
-- DELETE FROM users.
-- =====================================================

-- Step 1: Seed the sentinel user (idempotent).
INSERT INTO public.users (
  id, email, full_name, user_type, account_status, is_active, employee_id
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'deleted-user@system.local',
  '[Deleted User]',
  'internal',
  'inactive',
  false,
  'SYSTEM-DELETED'
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Replace the function. Iterates pg_constraint at runtime so
-- it adapts to schema drift without per-table maintenance.
CREATE OR REPLACE FUNCTION public.admin_permanent_delete_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sentinel_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
  v_fk RECORD;
BEGIN
  IF p_user_id = v_sentinel_id THEN
    RAISE EXCEPTION 'Cannot delete the sentinel user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- For every FK in public.* referencing public.users(id) where the
  -- delete action is NO ACTION ('a') or RESTRICT ('r') — i.e. the
  -- engine would block our DELETE — reassign rows away from the user:
  --   NOT NULL column → sentinel
  --   nullable column → NULL
  -- CASCADE ('c') and SET NULL ('n') columns are left untouched and
  -- will be handled by the final DELETE FROM public.users.
  FOR v_fk IN
    SELECT
      ns.nspname  AS schema_name,
      cl.relname  AS table_name,
      a.attname   AS column_name,
      a.attnotnull AS not_null
    FROM pg_constraint c
    JOIN pg_class cl       ON cl.oid = c.conrelid
    JOIN pg_namespace ns   ON ns.oid = cl.relnamespace
    JOIN pg_class fcl      ON fcl.oid = c.confrelid
    JOIN pg_namespace fns  ON fns.oid = fcl.relnamespace
    JOIN pg_attribute a    ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute fa   ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND fns.nspname = 'public'
      AND fcl.relname = 'users'
      AND fa.attname  = 'id'
      AND ns.nspname  = 'public'
      AND array_length(c.conkey, 1) = 1
      AND c.confdeltype IN ('a', 'r')
  LOOP
    IF v_fk.not_null THEN
      EXECUTE format(
        'UPDATE %I.%I SET %I = $2 WHERE %I = $1',
        v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name
      ) USING p_user_id, v_sentinel_id;
    ELSE
      EXECUTE format(
        'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
        v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name
      ) USING p_user_id;
    END IF;
  END LOOP;

  -- Final delete. CASCADE / SET NULL FKs trigger here.
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.admin_permanent_delete_user(UUID) IS
  'Permanently delete a user, reassigning their bookings/payments/uploads/etc. to the sentinel [Deleted User] row so historical records survive.';
