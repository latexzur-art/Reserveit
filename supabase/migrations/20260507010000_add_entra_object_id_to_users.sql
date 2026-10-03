-- Add entra_object_id to public.users so we can link a pre-registered internal
-- user to their Microsoft Entra (Azure AD) account before first sign-in.
--
-- Set when the User Manager provisions the Entra account via Microsoft Graph
-- from /admin/users. On first MS365 sign-in, the same id surfaces as
-- auth.users.user_metadata.custom_claims.oid — but storing it pre-emptively
-- lets the admin UI deterministically link to the Entra portal entry.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS entra_object_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_entra_object_id_key
  ON public.users (entra_object_id)
  WHERE entra_object_id IS NOT NULL;

COMMENT ON COLUMN public.users.entra_object_id IS
  'Microsoft Entra (Azure AD) directory object id. Populated when the account is provisioned via Microsoft Graph from the admin Users page.';
