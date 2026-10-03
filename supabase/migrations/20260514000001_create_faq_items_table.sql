-- =====================================================
-- FAQ Items Table
-- =====================================================
-- Description: Stores FAQ entries scoped by role_tags.
--   Building admin manages all FAQs; each role sees only
--   entries tagged for their role (or tagged 'all').
-- Date: 2026-05-14
-- =====================================================

CREATE TABLE IF NOT EXISTS public.faq_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'General',
  role_tags   TEXT[]      NOT NULL DEFAULT '{}',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS faq_items_role_tags_idx  ON public.faq_items USING GIN(role_tags);
CREATE INDEX IF NOT EXISTS faq_items_is_active_idx  ON public.faq_items(is_active);
CREATE INDEX IF NOT EXISTS faq_items_category_idx   ON public.faq_items(category);
CREATE INDEX IF NOT EXISTS faq_items_sort_order_idx ON public.faq_items(sort_order);

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active FAQs"
  ON public.faq_items FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Service role full access on faq_items"
  ON public.faq_items FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  public.faq_items              IS 'Role-scoped FAQ entries managed by building admin';
COMMENT ON COLUMN public.faq_items.role_tags    IS 'Array of role names that can see this FAQ, or [''all''] for everyone';
COMMENT ON COLUMN public.faq_items.answer       IS 'Markdown-formatted answer text';
COMMENT ON COLUMN public.faq_items.sort_order   IS 'Lower numbers appear first within a category';
