-- =====================================================
-- Migration: Phase 3 — Drop Unused & Redundant Indexes
-- Date: 2026-07-28
-- Description: Drops low-cardinality single-column boolean indexes
--              and redundant indexes backing unique constraints.
-- =====================================================

-- Low-cardinality boolean indexes
DROP INDEX IF EXISTS public.buildings_is_active_idx;
DROP INDEX IF EXISTS public.departments_is_active_idx;
DROP INDEX IF EXISTS public.facilities_is_active_idx;
DROP INDEX IF EXISTS public.facilities_is_bookable_idx;
DROP INDEX IF EXISTS public.facility_amenities_is_active_idx;
DROP INDEX IF EXISTS public.facility_types_is_active_idx;
DROP INDEX IF EXISTS public.equipment_status_types_is_bookable_idx;
DROP INDEX IF EXISTS public.equipment_types_is_active_idx;
DROP INDEX IF EXISTS public.floors_is_active_idx;
DROP INDEX IF EXISTS public.maintenance_staff_active_idx;
DROP INDEX IF EXISTS public.rental_rates_is_active_idx;
DROP INDEX IF EXISTS public.rental_rates_is_addon_idx;
DROP INDEX IF EXISTS public.roles_is_active_idx;
DROP INDEX IF EXISTS public.time_slots_is_active_idx;
DROP INDEX IF EXISTS public.user_roles_is_active_idx;
DROP INDEX IF EXISTS public.users_is_active_idx;
DROP INDEX IF EXISTS public.external_clients_is_blacklisted_idx;
DROP INDEX IF EXISTS public.external_clients_is_verified_idx;
DROP INDEX IF EXISTS public.faq_items_is_active_idx;

-- Redundant indexes backing unique constraints or primary keys
DROP INDEX IF EXISTS public.bookings_booking_reference_idx;
DROP INDEX IF EXISTS public.equipment_code_idx;
DROP INDEX IF EXISTS public.employee_registry_employee_id_idx;
DROP INDEX IF EXISTS public.employee_registry_email_idx;
DROP INDEX IF EXISTS public.time_slots_slot_code_idx;
