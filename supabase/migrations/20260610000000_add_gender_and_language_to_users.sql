-- Add gender and language columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS language TEXT;

COMMENT ON COLUMN public.users.gender IS 'User gender preference';
COMMENT ON COLUMN public.users.language IS 'User language preference';
