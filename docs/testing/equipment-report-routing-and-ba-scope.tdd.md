# TDD Evidence — Equipment issue-report routing + Building Admin scope gating

- **Date:** 2026-08-07
- **Source plan:** [`plans/pamo-equipment-role-and-dashboard.md`](../../plans/pamo-equipment-role-and-dashboard.md) — Phase 7 (professor report entry point) and Phase 6.2 (Building Admin re-scope).
- **Workflow:** `tdd-workflow` skill (RED → GREEN → refactor), repo conventions (Vitest + Testing Library, service tests deep / component tests via accessible queries).

## Problem being fixed

The professor "Report equipment issue" dialog posted only `{ category, description }` — no `facilityId`/`equipmentId`. The service derives `is_tech` **only** when an `equipmentId` is present, so every professor report defaulted to `is_tech=false` and escalated to **PAMO**, never IT Admin — a broken TV reported by a professor could never route to IT. Reports were also not linked to a room. (The Building Admin API already enforces building-only writes, so BA scope was a UX gap, not a data-integrity bug.)

## User journeys

1. **As a professor**, I file an equipment issue for a room I teach in on my fixed class schedule (no reservation), pick the specific item, so the report routes to the correct office (non-tech → PAMO, tech → IT Admin).
2. **As a professor with no scheduled rooms**, I can still file against a free-text room.
3. **As a Building Admin**, I see all equipment but can only edit/delete my own HVAC (building) rows; PAMO/IT rows are read-only.

## Task report

### T1 — Structured report payload (routing fix)
- **Summary:** Extracted `buildIssueReportPayload` — includes `facilityId`/`equipmentId` when selected, folds free-text location into the description only as a fallback.
- **RED:** `npx vitest run __tests__/lib/equipment/report-form.test.ts` → *Failed to resolve import "@/lib/equipment/report-form"* (module absent → compile-time RED).
- **GREEN:** after adding `lib/equipment/report-form.ts` → 8 passed.
- **Guarantees:** payload carries structured identifiers so the server can derive `is_tech`; free-text path preserved for the no-schedule case.

### T2 — Rooms from class schedule
- **Summary:** `roomsFromClasses` derives distinct rooms from `GET /api/schedules/my-classes` (flattened `facility` object; tolerant of a raw supabase `facilities` join array). Skips classes with no facility.
- **RED note:** first draft asserted a fabricated shape; corrected the test to the **actual** API contract (`{ classes: [{ facility: { id, name, room_number, building } }] }`), which went RED against the initial impl, then GREEN after aligning the parser. Documented here as an interpretation correction, not a silent scope change.
- **GREEN:** included in the 8 passing `report-form` tests.

### T3 — `is_tech` routing contract (regression guard)
- **Summary:** `EquipmentIssueReportsService.create` marks `is_tech=true` for IT-managed items, `false` for PAMO-managed, `false` when no item is attached.
- **Result:** GREEN from the start (3 passed) — proves the service logic was already correct, confirming the defect was purely the missing UI/data wiring.

### T4 — Equipment-by-facility read
- **Summary:** New `EquipmentIssueReportsService.listEquipmentForFacility(facilityId)` returns `{ id, equipmentCode, equipmentName, isTech }[]`; new `GET /api/facilities/[id]/equipment` (guard: `requireAuthenticatedUser`) backs the dialog's item picker.
- **RED:** `EquipmentIssueReportsService.listEquipmentForFacility is not a function` (2 failing tests).
- **GREEN:** after adding the method → 2 passed.

### T5 — Building Admin row capability policy (Phase 6.2)
- **Summary:** `equipmentRowCapabilities(managedBy)` → `{ canEdit, canDelete, canAssign, canRequestAssign, canReport, readOnly }`. building = edit/delete/report; pamo = assign/report read-only; it = request-assign/report read-only. `EquipmentTable` row gating refactored from an inline `managedBy === 'building'` check to this policy (behavior-preserving), guarded by a component test.
- **RED:** `Failed to resolve import "@/lib/equipment/row-capabilities"` (compile-time RED).
- **GREEN:** after adding `lib/equipment/row-capabilities.ts` → 4 passed; `EquipmentTable.scope.test.tsx` → 3 passed.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|--------------------|------|------|--------|
| 1 | Payload includes facilityId + equipmentId when a room + item are picked | `report-form.test.ts` | unit | PASS |
| 2 | Free-text location folds into description only when no facility chosen | `report-form.test.ts` | unit | PASS |
| 3 | Distinct rooms derived from the my-classes response; null-facility skipped | `report-form.test.ts` | unit | PASS |
| 4 | `create` sets is_tech=true for IT items → routes to IT Admin | `issue-reports.service.test.ts` | unit | PASS |
| 5 | `create` sets is_tech=false for PAMO items / no item → routes to PAMO | `issue-reports.service.test.ts` | unit | PASS |
| 6 | `listEquipmentForFacility` returns items with isTech from managed_by | `issue-reports.service.test.ts` | unit | PASS |
| 7 | BA can edit/delete HVAC (building) rows | `EquipmentTable.scope.test.tsx` | component | PASS |
| 8 | BA sees IT/PAMO rows read-only (no edit/delete) | `EquipmentTable.scope.test.tsx` | component | PASS |
| 9 | Row capability policy matches the ownership matrix | `row-capabilities.test.ts` | unit | PASS |

## Suite + typecheck

- `npx vitest run` → **69 files, 671 tests passed** (no regressions).
- `npx tsc --noEmit` → exit 0 (clean).

## Known gaps / follow-ups (not correctness bugs — API already enforces safety)

- **BA "all equipment" page header:** global Add / Bulk Import / Clear-All controls still render, though HVAC now has its own tab and the server scopes BA writes to `building`. Stripping them (and adding per-row **Report issue** / **Assign** / **Request assignment** actions from Phase 6.2) is additive UX best done with the app running (`/verify` or `/run`), not blind.
- The professor dialog's room/equipment pickers use Radix Select; interaction wasn't asserted in jsdom (repo convention). The fix's logic is covered by the pure-unit tests above; end-to-end behavior should be smoke-tested in-app.
