-- =====================================================
-- Re-scope building_admin equipment permissions
-- =====================================================
-- Description: Building Admin no longer owns PAMO/IT inventory. It keeps
--   HVAC (building fixture) CRUD, non-tech assign/move, tech assignment
--   requests, and report triage/escalation. Documentation-level; enforced
--   at the API guard layer.
-- Date: 2026-08-06
-- =====================================================

UPDATE public.roles
  SET permissions = permissions ||
    '{"equipment":["read","assign"],"equipment_requests":["create","read"],"hvac":["create","read","update","delete"],"reports":["read","update","escalate"]}'::jsonb,
      updated_at = NOW()
  WHERE name = 'building_admin';
