import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
    console.log('Applying policy updates directly to the database via query_raw...')

    // We can use query_raw if it exists, or submit it through a custom RPC if we made one.
    // If not, we can try using the REST API or just fetching it.
    // Often we don't have exec_sql available. Let's try exec_sql if it's there.
    const { data: res1, error: err1 } = await supabase.rpc('query_raw', { query: sql })
    if (err1) {
        console.error('RPC failed:', err1.message)
    } else {
        console.log('Success!', res1)
    }
}
run()
