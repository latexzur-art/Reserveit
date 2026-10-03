-- =====================================================
-- Phase 1.2: Create Facility Aliases Table
-- =====================================================
-- Description: Flexible facility name matching for schedule uploads
-- Date: 2026-02-02
-- =====================================================

-- Create facility_aliases table
CREATE TABLE IF NOT EXISTS public.facility_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,                     -- e.g., "Comp Lab 2", "CL2"
  alias_normalized VARCHAR(100) NOT NULL,          -- Lowercase, no spaces, for matching
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint on normalized alias
  CONSTRAINT facility_aliases_normalized_unique UNIQUE (alias_normalized)
);

-- Indexes
CREATE INDEX IF NOT EXISTS facility_aliases_facility_id_idx ON public.facility_aliases(facility_id);
CREATE INDEX IF NOT EXISTS facility_aliases_normalized_idx ON public.facility_aliases(alias_normalized);

-- Enable Row Level Security
ALTER TABLE public.facility_aliases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read facility aliases
CREATE POLICY "Anyone can view facility aliases"
  ON public.facility_aliases FOR SELECT
  USING (true);

-- Service role has full access
CREATE POLICY "Service role can manage facility aliases"
  ON public.facility_aliases FOR ALL
  USING (auth.role() = 'service_role');

-- Function to normalize alias text
CREATE OR REPLACE FUNCTION public.normalize_facility_alias(p_alias TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(p_alias, '[^a-zA-Z0-9]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-normalize alias on insert/update
CREATE OR REPLACE FUNCTION public.set_normalized_alias()
RETURNS TRIGGER AS $$
BEGIN
  NEW.alias_normalized := public.normalize_facility_alias(NEW.alias);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_normalized_alias
  BEFORE INSERT OR UPDATE ON public.facility_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_normalized_alias();

-- Function to find facility by alias
CREATE OR REPLACE FUNCTION public.find_facility_by_alias(p_alias TEXT)
RETURNS UUID AS $$
DECLARE
  v_facility_id UUID;
  v_normalized TEXT;
BEGIN
  v_normalized := public.normalize_facility_alias(p_alias);

  SELECT facility_id INTO v_facility_id
  FROM public.facility_aliases
  WHERE alias_normalized = v_normalized
  LIMIT 1;

  RETURN v_facility_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add alias for facility
CREATE OR REPLACE FUNCTION public.add_facility_alias(
  p_facility_id UUID,
  p_alias TEXT,
  p_is_primary BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_alias_id UUID;
BEGIN
  INSERT INTO public.facility_aliases (facility_id, alias, is_primary)
  VALUES (p_facility_id, p_alias, p_is_primary)
  ON CONFLICT (alias_normalized) DO NOTHING
  RETURNING id INTO v_alias_id;

  RETURN v_alias_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed initial aliases from existing facilities
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, code, name FROM public.facilities LOOP
    -- Add code as alias
    INSERT INTO public.facility_aliases (facility_id, alias, alias_normalized, is_primary)
    VALUES (r.id, r.code, public.normalize_facility_alias(r.code), TRUE)
    ON CONFLICT (alias_normalized) DO NOTHING;

    -- Add name as alias
    INSERT INTO public.facility_aliases (facility_id, alias, alias_normalized, is_primary)
    VALUES (r.id, r.name, public.normalize_facility_alias(r.name), FALSE)
    ON CONFLICT (alias_normalized) DO NOTHING;
  END LOOP;
END $$;

-- Add comments
COMMENT ON TABLE public.facility_aliases IS 'Flexible facility name matching for schedule file uploads';
COMMENT ON COLUMN public.facility_aliases.alias IS 'Human-readable alias like "Comp Lab 2" or "CL2"';
COMMENT ON COLUMN public.facility_aliases.alias_normalized IS 'Lowercase, alphanumeric only, for matching';
COMMENT ON FUNCTION public.find_facility_by_alias IS 'Finds facility ID from an alias string';
COMMENT ON FUNCTION public.normalize_facility_alias IS 'Normalizes alias text for consistent matching';
