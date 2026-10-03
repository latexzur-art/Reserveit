import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const conn = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', 'postgres://postgres:').replace('.supabase.co', ':6543/postgres')

const sql = `
-- 1. Fix public.users policies
DROP POLICY IF EXISTS "User managers can view all users" ON public.users;
CREATE POLICY "User managers can view all users"
  ON public.users FOR SELECT
  USING (public.user_has_any_role(ARRAY['it_admin', 'building_admin', 'school_admin']));

DROP POLICY IF EXISTS "User managers can create users" ON public.users;
CREATE POLICY "User managers can create users"
  ON public.users FOR INSERT
  WITH CHECK (public.user_has_role('it_admin'));

DROP POLICY IF EXISTS "User managers can update users" ON public.users;
CREATE POLICY "User managers can update users"
  ON public.users FOR UPDATE
  USING (public.user_has_role('it_admin'));

-- 2. Fix public.user_roles policies
DROP POLICY IF EXISTS "User managers can view all roles" ON public.user_roles;
CREATE POLICY "User managers can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.user_has_any_role(ARRAY['it_admin', 'building_admin', 'school_admin']));

DROP POLICY IF EXISTS "User managers can manage roles" ON public.user_roles;
CREATE POLICY "User managers can manage roles"
  ON public.user_roles FOR ALL
  USING (public.user_has_role('it_admin'));
`

async function run() {
    console.log('Connecting to', conn?.substring(0, 30) + '...')
    // For supabase connection strings. The best source is usually DIRECT_URL from env
    const directUrl = process.env.DIRECT_URL;
    if (!directUrl) {
        console.log('No DIRECT_URL found in .env.local')
        return;
    }
    const client = new Client({ connectionString: directUrl })
    try {
        await client.connect()
        console.log('Connected!')
        await client.query(sql)
        console.log('Applied policies successfully!')
    } catch (err: any) {
        console.error('Error:', err.message)
    } finally {
        await client.end()
    }
}
run()
