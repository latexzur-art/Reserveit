-- =====================================================
-- Rename user_manager role display label -> "IT Admin"
-- =====================================================
-- Description: The user_manager role now also owns the tech equipment
--   inventory, so its user-facing display name becomes "IT Admin". The role
--   SLUG (name = 'user_manager') is intentionally unchanged — it is wired into
--   routing, guards, RLS, and ROLE_HOME/ROUTE_ROLE_MAP.
-- Date: 2026-08-06
-- =====================================================

UPDATE public.roles
  SET display_name = 'IT Admin', updated_at = NOW()
  WHERE name = 'user_manager';
