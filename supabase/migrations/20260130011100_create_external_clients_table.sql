-- =====================================================
-- Phase 1.2: Create External Clients Table
-- =====================================================
-- Description: Non-STI client profiles for external facility rentals
-- Date: 2026-01-30
-- =====================================================

-- Create external_clients table
CREATE TABLE IF NOT EXISTS public.external_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Links to users table
  organization_name TEXT,
  organization_type TEXT, -- Company, Government, NGO, Individual, etc.
  contact_person TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,

  -- Verification documents
  valid_id_type TEXT, -- Government ID, Business Permit, etc.
  valid_id_number TEXT,
  valid_id_url TEXT, -- Uploaded ID storage path
  business_permit_url TEXT, -- For organizations
  other_documents_url TEXT[], -- Array of additional document URLs

  -- Verification status
  is_verified BOOLEAN DEFAULT false,
  verified_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,

  -- Blacklist/trust status
  is_blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  blacklisted_at TIMESTAMP WITH TIME ZONE,
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS external_clients_user_id_idx ON public.external_clients(user_id);
CREATE INDEX IF NOT EXISTS external_clients_organization_name_idx ON public.external_clients(organization_name);
CREATE INDEX IF NOT EXISTS external_clients_contact_email_idx ON public.external_clients(contact_email);
CREATE INDEX IF NOT EXISTS external_clients_is_verified_idx ON public.external_clients(is_verified);
CREATE INDEX IF NOT EXISTS external_clients_is_blacklisted_idx ON public.external_clients(is_blacklisted) WHERE is_blacklisted = true;

-- Enable Row Level Security
ALTER TABLE public.external_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view and update their own external client profile
CREATE POLICY "Users can view own external client profile"
  ON public.external_clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own external client profile"
  ON public.external_clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can create their own external client profile
CREATE POLICY "Users can create own external client profile"
  ON public.external_clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access (for admin verification)
CREATE POLICY "Service role can manage external clients"
  ON public.external_clients FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_external_clients_updated_at
  BEFORE UPDATE ON public.external_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to verify external client
CREATE OR REPLACE FUNCTION public.verify_external_client(
  p_client_id UUID,
  p_verified_by_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.external_clients
  SET is_verified = true,
      verified_by_user_id = p_verified_by_user_id,
      verified_at = NOW(),
      verification_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_client_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to blacklist external client
CREATE OR REPLACE FUNCTION public.blacklist_external_client(
  p_client_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.external_clients
  SET is_blacklisted = true,
      blacklist_reason = p_reason,
      blacklisted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_client_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a verified external client
CREATE OR REPLACE FUNCTION public.is_verified_external_client(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.external_clients
    WHERE user_id = p_user_id
      AND is_verified = true
      AND is_blacklisted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.external_clients IS 'External (non-STI) client profiles for facility rentals';
COMMENT ON COLUMN public.external_clients.user_id IS 'Links to the users table - every external client has a user account';
COMMENT ON COLUMN public.external_clients.valid_id_url IS 'Storage path to uploaded valid ID document';
COMMENT ON COLUMN public.external_clients.trust_score IS 'Client trust score (0-100) based on booking history';
COMMENT ON FUNCTION public.verify_external_client IS 'Admin function to verify an external client';
COMMENT ON FUNCTION public.is_verified_external_client IS 'Check if a user is a verified external client';
