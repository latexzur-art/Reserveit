-- Facility capacity had no floor anywhere in the stack — the column is
-- INTEGER NOT NULL DEFAULT 0 with no CHECK, and neither the admin form nor
-- building-facilities.service.ts rejected 0 or negative values. This adds the
-- DB-level backstop those app-layer fixes rely on. NOT VALID skips checking
-- existing rows at migration time (fast, no lock contention); run
-- VALIDATE CONSTRAINT in a follow-up once existing data is confirmed clean.

ALTER TABLE public.facilities
  ADD CONSTRAINT facilities_capacity_positive CHECK (capacity > 0) NOT VALID;
