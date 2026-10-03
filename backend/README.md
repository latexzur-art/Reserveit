# ReserveIT Backend Services

This folder contains all backend-related code and services for the ReserveIT application.

## Structure

```
backend/
├── auth/                    # Authentication services
│   ├── auth.service.ts      # Core auth operations
│   ├── auth.types.ts        # TypeScript types for auth
│   ├── auth.constants.ts    # Role routes, priorities, etc.
│   └── auth.utils.ts        # Helper functions
├── users/                   # User management services
│   ├── users.service.ts     # User CRUD operations
│   └── users.types.ts       # User-related types
└── README.md
```

## Usage

Import services in your Next.js API routes or server components:

```typescript
import { AuthService } from '@/backend/auth/auth.service'
import { UsersService } from '@/backend/users/users.service'
```

## Database Migrations

Auth-related migrations are located in:
- `supabase/migrations/20260205010100_alter_users_table_for_auth.sql`
- `supabase/migrations/20260205010200_alter_roles_table_for_auth.sql`
- `supabase/migrations/20260205010300_create_auth_triggers.sql`
- `supabase/migrations/20260205010400_create_auth_rls_policies.sql`
- `supabase/migrations/20260205010500_create_auth_helper_functions.sql`
