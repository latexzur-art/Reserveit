# Codebase Conventions

Established in Phase 0 of the per-role dashboard refactor
(`plans/2026-06-10-per-role-dashboard-refactor.md`).

## Routes

- All page URLs live in `lib/routes.ts` (`ROUTES.<role>.*`). Never hardcode
  route strings in pages, components, hooks, middleware, or email builders.
- `ROLE_HOME` (same module) is the single source of truth for post-login
  landing pages. `backend/auth` and middleware derive from it.
- API folders keep their existing names; the inconsistently-named groups are
  documented via `API_ROUTES` constants in `lib/routes.ts`.

## Shared UI and hooks

- Anything imported by 2+ role trees lives in `components/shared/` or
  `hooks/shared/` — never under another role's `_components`/`_hooks`.
- Role-private components/hooks are colocated: `app/<role>/**/_components/`
  and `app/<role>/**/_hooks/`.
- `components/shared/RoleTopBar.tsx` is the shared dashboard top bar.
  Role differences are props: `formRoute`, `calendarRoute`, `profileMenu`.

## API route handlers

- Error shape: `{ error: string, code?: string }` — produce it with
  `apiError(status, message, code?)` from `lib/api/response.ts`.
- Success: `apiSuccess(data, status?)`.
- Unexpected errors: wrap handler bodies in try/catch and finish with
  `apiUnexpectedError(context, err)` — logs details server-side, returns a
  sanitized 500 (`lib/errors.ts:sanitizeDbError`).
- Validation: zod via `parseBody(request, schema)` / `parseQuery(request, schema)`
  from `lib/api/validate.ts`; UUID params via `lib/api/validate-uuid.ts`.
- Every role-scoped route must call its role guard (e.g. `requireUserManager`,
  `requireBuildingAdmin`) before touching data.

## Legacy URLs

- Old URLs are never dropped: flattened trees keep `[[...rest]]` catch-all
  redirect pages until at least one release after Phase 7.
