-- =====================================================
-- Migration: Phase 4 — Empty & Unused Table Cleanup
-- Date: 2026-07-28
-- Description: Drops confirmed-unused tables that have 0 rows and zero application code references.
--              Preserves active tables (facility_aliases, score_reset_requests, messages).
-- =====================================================

DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.maintenance_records CASCADE;
DROP TABLE IF EXISTS public.term_course_activations CASCADE;
