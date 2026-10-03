-- ============================================
-- System Settings Table
-- ============================================
-- Key-value store for system-wide configuration
-- (institution info, branding, academic calendar)

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_settings_key ON public.system_settings(key);
CREATE INDEX idx_system_settings_category ON public.system_settings(category);

-- RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
  ON public.system_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage settings"
  ON public.system_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default settings
INSERT INTO public.system_settings (key, value, category, description) VALUES
  ('institution_name', '"STI College Lucena"', 'general', 'Full name of the institution'),
  ('app_name', '"ReserveIT"', 'general', 'Application display name'),
  ('admin_contact_email', '""', 'general', 'Admin contact email address'),
  ('admin_contact_phone', '""', 'general', 'Admin contact phone number'),
  ('academic_year', '"2025-2026"', 'academic', 'Current academic year'),
  ('current_semester', '"2nd Semester"', 'academic', 'Current semester')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.system_settings IS 'Key-value store for system-wide configuration';
