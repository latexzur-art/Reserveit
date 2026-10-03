-- =====================================================
-- Grant user_manager (IT Admin) tech-equipment permissions
-- =====================================================
-- Description: The IT Administrator (user_manager) now owns the tech
--   equipment inventory and handles escalated tech reports + BA assignment
--   requests. Documentation-level permissions; enforcement is at the API
--   guard layer.
-- Date: 2026-08-06
-- =====================================================

UPDATE public.roles
  SET permissions = permissions ||
    '{"equipment":["create","read","update","delete"],"equipment_types":["read"],"reports":["read","update"],"equipment_requests":["read","update"]}'::jsonb,
      updated_at = NOW()
  WHERE name = 'user_manager';
