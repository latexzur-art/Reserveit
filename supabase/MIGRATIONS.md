# Migration Status

Cross-reference of local files vs what is actually applied in the remote DB.

> **Tracked** = present in `supabase_migrations` table (applied via CLI).  
> **Manual** = confirmed applied via SQL editor; NOT in `supabase_migrations`.  
> **Pending** = local file exists but NOT yet applied anywhere.  
> **DB-only** = applied in remote DB but no local file exists.

---

## Foundational Schema (all Manual — applied before CLI tracking was set up)

| File | Status |
|------|--------|
| 20260129010000_create_utility_functions | ✅ Tracked |
| 20260129010100_create_roles_table | ✅ Manual |
| 20260129010200_create_departments_table | ✅ Manual |
| 20260129010300_create_users_table | ✅ Manual |
| 20260129010400_create_user_roles_table | ✅ Manual |
| 20260129010500_create_facility_types_table | ✅ Manual |
| 20260129010600_create_facility_amenities_table | ✅ Manual |
| 20260129010700_create_buildings_table | ✅ Manual |
| 20260129010800_create_floors_table | ✅ Manual (table confirmed in DB) |
| 20260129010900_create_facilities_table | ✅ Manual |
| 20260129011000_create_facility_amenity_map_table | ✅ Manual |
| 20260130010000_create_employee_registry_table | ✅ Manual |
| 20260130010100_create_equipment_types_table | ✅ Manual |
| 20260130010200_create_equipment_status_types_table | ✅ Manual |
| 20260130010300_create_equipment_table | ✅ Manual |
| 20260130010400_create_equipment_status_log_table | ✅ Manual |
| 20260130010500_create_time_slots_table | ✅ Manual |
| 20260130010600_create_bookings_table | ✅ Manual |
| 20260130010700_create_booking_facilities_table | ✅ Manual |
| 20260130010800_create_booking_equipment_table | ✅ Manual |
| 20260130010900_create_booking_status_history_table | ✅ Manual |
| 20260130011000_create_rental_rates_table | ✅ Manual |
| 20260130011100_create_external_clients_table | ✅ Manual |
| 20260130011200_create_payments_table | ✅ Manual |
| 20260202010100_create_academic_terms_table | ✅ Manual |
| 20260202010200_create_facility_aliases_table | ✅ Manual |
| 20260202010300_create_schedule_uploads_table | ✅ Manual |
| 20260202010400_create_schedule_entries_staging_table | ✅ Manual |
| 20260202010500_create_class_schedules_table | ✅ Manual |
| 20260202010600_create_schedule_change_requests_table | ✅ Manual |
| 20260205010100_alter_users_table_for_auth | ✅ Manual |
| 20260205010200_alter_roles_table_for_auth | ✅ Manual |
| 20260205010300_create_auth_triggers | ✅ Manual |
| 20260205010400_create_auth_rls_policies | ✅ Manual |
| 20260205010500_create_auth_helper_functions | ✅ Manual |
| 20260207010100_create_notifications_table | ✅ Manual |
| 20260207010200_create_messages_table | ✅ Manual |
| 20260207010300_create_broadcasts_table | ✅ Manual |
| 20260207010400_create_message_templates_table | ✅ Manual |
| 20260207010500_create_audit_logs_table | ✅ Manual |
| 20260208010100_cleanup_roles_and_seed_admin | ✅ Manual |
| 20260210010100_create_system_settings_table | ✅ Manual |

---

## Feature Migrations (Manual era)

| File | Status |
|------|--------|
| 20260219010100_booking_pipeline_foundation | ✅ Manual |
| 20260220010000_seed_booking_rules | ✅ Manual |
| 20260220010100_flag_restricted_facilities | ✅ Manual |
| 20260220010200_seed_sample_class_schedules | ✅ Manual |
| 20260220020000_remove_lab_restrictions | ✅ Manual |
| 20260220030000_seed_actual_facilities | ✅ Manual (data confirmed in DB) |
| 20260222010000_facility_purpose_mismatch | ✅ Manual |
| 20260222010100_facility_mismatch_seed | ✅ Manual |
| 20260222120706_dummy0 | ✅ Tracked |
| 20260222121854_dummy1 | ✅ Tracked |
| 20260222122546_dummy2 | ✅ Tracked |
| 20260223014500_mismatch_expansion | ✅ Manual |
| 20260223060000_schedule_management_expansion | ✅ Manual |
| 20260225000000_allow_cascade_delete_terms | ✅ Tracked |
| 20260226010100_fix_users_rls_recursion | ✅ Manual |
| 20260226010200_add_is_published_to_staging | ✅ Manual |
| 20260226010300_drop_future_date_constraint | ✅ Manual |
| 20260226020000_fix_handle_new_user_trigger | ✅ Manual |
| 20260227000000_fix_booking_facilities_update_policy | ✅ Manual |
| 20260301142123_enrollment_and_school_events | ✅ Manual |
| 20260302_add_course_selection | ✅ Manual |
| 20260305000000_add_school_event_block_booking_type | ✅ Manual |
| 20260305000001_add_auto_complete_bookings_function | ✅ Manual |
| 20260312000000_add_class_schedule_conflict_trigger | ✅ Manual |
| 20260316000000_create_maintenance_records_table | ✅ Manual |
| 20260317000000_create_user_preferences | ✅ Manual |
| 20260318000100_evolve_notifications_schema | ✅ Manual |
| 20260328000000_add_gymnasium_facility | ✅ Manual |
| 20260414000000_fix_booking_reference_advisory_lock | ✅ Manual |
| 20260414000001_add_alternative_declined_cancellation_type | ✅ Manual |
| 20260415000001_create_course_uploads_table | ✅ Manual |
| 20260415000002_create_courses_table | ✅ Manual |
| 20260415000003_create_term_course_activations_table | ✅ Manual |
| 20260416000001_fix_courses_table_constraints | ✅ Manual |
| 20260416071206_fix_courses_table_constraints | ✅ Tracked |
| 20260417000000_fix_class_schedule_conflict_trigger | ✅ Manual |
| 20260420000001_add_org_contact_to_bookings | ✅ Manual |
| 20260422000001_fix_external_user_auth_id | ✅ Manual |
| 20260422000002_add_metadata_to_bookings | ✅ Manual |
| 20260422031218_fix_external_user_auth_id | ✅ Tracked |
| 20260422045313_add_metadata_to_bookings | ✅ Tracked |
| 20260423000001_add_extension_booking_fields | ✅ Manual |
| 20260423172344_add_org_contact_to_bookings | ✅ Tracked |
| 20260424000000_add_payment_status_to_bookings | ✅ Manual |
| 20260424000100_handle_facility_block_overrides | ✅ Manual |
| 20260424092031_add_extension_booking_fields | ✅ Tracked |
| 20260424093645_add_payment_status_to_bookings | ✅ Tracked |
| 20260424093703_handle_facility_block_overrides | ✅ Tracked |
| 20260501000001_paymongo_complete_payment_idempotent | ✅ Manual |
| 20260501000002_apply_booking_proposal_atomic | ✅ Manual |
| 20260501000003_payments_unique_active | ✅ Manual |
| 20260507010000_add_entra_object_id_to_users | ✅ Manual |
| 20260507162556_admin_permanent_delete_user_function | ✅ Tracked |
| 20260508000000_add_booking_overlap_lock_trigger | ✅ Tracked |
| 20260508000100_add_policy_override_flag | ✅ Tracked |
| 20260508000200_add_cancellation_lead_time | ✅ Tracked |
| 20260508010000_admin_permanent_delete_user_function | ✅ Manual |
| 20260508020000_fix_booking_course_code_fkey | ✅ Manual |
| 20260508035553_fix_booking_course_code_fkey | ✅ Tracked |
| 20260511000000_add_new_equipment_types | ✅ Manual (34 equipment types confirmed in DB) |
| 20260511212700_fix_floor_mapping_and_assignments | ✅ Manual (floor names + assignments confirmed in DB) |
| 20260515000000_payment_completed_trigger | ✅ Manual |
| 20260520000001_create_maintenance_staff_table | ✅ Tracked (as 20260511031152) |
| 20260520000002_create_facility_maintenance_assignments | ✅ Tracked (as 20260511031208) |
| 20260520000003_link_maintenance_records_to_staff | ✅ Tracked (as 20260511031219) |
| 20260514141641_create_messaging_system | 🕒 Pending |
| 20260521010000_create_session_credits | ✅ Tracked — applied via MCP apply_migration (session_credits + emergency_cancellation_requests + RPCs + system_settings seed) |
| 20260619000000_autolink_profile_on_login | ✅ Applied to **dev + prod** via MCP apply_migration — extends `update_user_last_login` to auto-link pre-created/unlinked profiles by email on every login (fixes "not yet set up" when the auth user predates the profile) |

---

## DB-Only (applied remotely, no local file)

| Version in DB | Status |
|---------------|--------|
| 20260408084042_enforce_single_active_academic_head | ✅ Tracked — **no local .sql file** |
| 20260512045048_allow_cross_midnight_time_range_in_rental_rates | ✅ Tracked — **no local .sql file** |

> These were applied directly in the Supabase dashboard without saving the file locally.
> Consider recreating them as local files for a complete history.

---

## Going Forward

From this point on, **always** create and apply migrations through the CLI:

```bash
# 1. Create a new migration file
supabase migration new <descriptive_name>

# 2. Write your SQL in the generated file, then apply it
supabase db push

# 3. To repair history for already-applied manual migrations (optional cleanup):
supabase migration repair --status applied <version>
# e.g.: supabase migration repair --status applied 20260129010800
```

The `repair` command inserts the version into `supabase_migrations` without re-running the SQL,
so you can bring the tracker in sync with reality without risk.
