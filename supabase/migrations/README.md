# Database Migrations

This directory contains SQL migration files for the ReserveIt database schema.

## Migration Naming Convention

Migrations are automatically timestamped and named by the Supabase CLI:
```
YYYYMMDDHHMMSS_description_of_changes.sql
```

Example: `20260129150000_create_users_table.sql`

## Creating a New Migration

### Method 1: Create Migration File (Recommended)
```bash
# Create a new migration file with a description
npm run migration:new create_users_table

# Or use the Supabase CLI directly
npx supabase migration new create_users_table
```

This creates a timestamped file in `supabase/migrations/` where you can write your SQL.

### Method 2: Generate from Existing Database
```bash
# Pull changes from your remote database
npx supabase db pull
```

## Writing Migrations

Each migration file should contain:
1. **Forward migration** - SQL to apply changes
2. **Comments** - Explain what and why
3. **Idempotent** - Safe to run multiple times (use `IF NOT EXISTS`, etc.)

### Example Migration
```sql
-- Description: Create users table to extend Supabase Auth
-- Phase: 1.2 - Core Schema Implementation

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_department_idx ON public.users(department_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Applying Migrations

### To Remote Database (Your Supabase Project)
```bash
# Link to your remote project (one-time setup)
npx supabase link --project-ref aascxdiyetopvrxifape

# Push migrations to remote database
npm run migration:push

# Or use CLI directly
npx supabase db push
```

### To Local Database (Optional - for testing)
```bash
# Start local Supabase (Docker required)
npx supabase start

# Apply migrations to local DB
npx supabase db reset
```

## Migration Workflow

### Recommended Workflow for ReserveIt:

1. **Write SQL in VS Code**
   ```bash
   npm run migration:new create_facilities_table
   ```

2. **Edit the generated file** in `supabase/migrations/`
   - Write your CREATE TABLE statements
   - Add constraints, indexes, triggers
   - Add comments explaining the schema

3. **Apply to remote database**
   ```bash
   npm run migration:push
   ```

4. **Verify in Supabase Dashboard**
   - Go to Table Editor to see your new tables
   - Check SQL Editor for migration history

## Migration History

Supabase tracks applied migrations in the `supabase_migrations.schema_migrations` table. You can view migration status with:
```bash
npx supabase migration list
```

## Best Practices

1. **One migration per logical change** - Don't bundle unrelated changes
2. **Descriptive names** - `create_facilities_table` not `new_table`
3. **Test migrations** - Run locally before pushing to production
4. **Add comments** - Explain complex logic or business rules
5. **Use transactions** - Migrations run in transactions by default
6. **Handle errors** - Use `IF NOT EXISTS` for idempotency

## Rollback

Migrations don't support automatic rollback. To undo:
1. Create a new migration that reverses the changes
2. Or manually run SQL in Supabase Dashboard

Example rollback migration:
```bash
npm run migration:new rollback_facilities_table
```

```sql
-- Rollback: Drop facilities table
DROP TABLE IF EXISTS public.facilities CASCADE;
```

## Common Operations

### Add a column
```sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone TEXT;
```

### Modify a column
```sql
ALTER TABLE public.users
ALTER COLUMN full_name SET NOT NULL;
```

### Create an index
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_created_at_idx
ON public.users(created_at DESC);
```

### Add a foreign key
```sql
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
```

## Troubleshooting

### "Project not linked"
```bash
npx supabase link --project-ref aascxdiyetopvrxifape
```

### "Authentication required"
```bash
npx supabase login
```

### "Migration failed"
- Check SQL syntax in the migration file
- Verify table/column names don't conflict
- Check foreign key references exist
- Review error message in console

## Resources

- [Supabase CLI Migrations Docs](https://supabase.com/docs/guides/cli/managing-migrations)
- [PostgreSQL SQL Syntax](https://www.postgresql.org/docs/current/sql-commands.html)
- [ReserveIt Schema Plan](../../plan.md#12-core-schema-implementation-22-table-architecture)
