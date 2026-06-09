-- ============================================================
-- KonaData v2 — RESET (exécuter AVANT full_schema.sql si échec)
-- Supprime l'ancien schéma v1 ou une installation partielle
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS setup_demo_user(TEXT, UUID, app_role, TEXT) CASCADE;
DROP FUNCTION IF EXISTS setup_demo_user(TEXT, UUID, user_role, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_organization_with_owner(TEXT, organization_type, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_konascore(UUID) CASCADE;
DROP FUNCTION IF EXISTS log_audit(audit_action, TEXT, UUID, JSONB) CASCADE;

-- Tables métier (ordre inverse des dépendances)
DROP TABLE IF EXISTS konascore_snapshots CASCADE;
DROP TABLE IF EXISTS btp_daily_progress CASCADE;
DROP TABLE IF EXISTS btp_fuel_logs CASCADE;
DROP TABLE IF EXISTS btp_delivery_notes CASCADE;
DROP TABLE IF EXISTS btp_stock CASCADE;
DROP TABLE IF EXISTS btp_equipment CASCADE;
DROP TABLE IF EXISTS btp_personnel CASCADE;
DROP TABLE IF EXISTS btp_contracts CASCADE;
DROP TABLE IF EXISTS btp_sites CASCADE;
DROP TABLE IF EXISTS ngo_beneficiaries CASCADE;
DROP TABLE IF EXISTS ngo_survey_responses CASCADE;
DROP TABLE IF EXISTS ngo_surveys CASCADE;
DROP TABLE IF EXISTS ngo_indicators CASCADE;
DROP TABLE IF EXISTS ngo_activities CASCADE;
DROP TABLE IF EXISTS ngo_projects CASCADE;
DROP TABLE IF EXISTS ngo_programs CASCADE;
DROP TABLE IF EXISTS school_report_cards CASCADE;
DROP TABLE IF EXISTS school_student_documents CASCADE;
DROP TABLE IF EXISTS school_schedules CASCADE;
DROP TABLE IF EXISTS school_payments CASCADE;
DROP TABLE IF EXISTS school_grades CASCADE;
DROP TABLE IF EXISTS school_enrollments CASCADE;
DROP TABLE IF EXISTS school_students CASCADE;
DROP TABLE IF EXISTS school_teachers CASCADE;
DROP TABLE IF EXISTS school_subjects CASCADE;
DROP TABLE IF EXISTS school_classes CASCADE;
DROP TABLE IF EXISTS pme_transactions CASCADE;
DROP TABLE IF EXISTS pme_expenses CASCADE;
DROP TABLE IF EXISTS pme_purchases CASCADE;
DROP TABLE IF EXISTS pme_sales CASCADE;
DROP TABLE IF EXISTS pme_products CASCADE;
DROP TABLE IF EXISTS pme_suppliers CASCADE;
DROP TABLE IF EXISTS pme_customers CASCADE;
DROP TABLE IF EXISTS document_extractions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS core_persons CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Fonctions RLS
DROP FUNCTION IF EXISTS owns_school_student(UUID) CASCADE;
DROP FUNCTION IF EXISTS owns_person(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_btp_staff_role() CASCADE;
DROP FUNCTION IF EXISTS is_ngo_staff_role() CASCADE;
DROP FUNCTION IF EXISTS is_school_student_or_candidate() CASCADE;
DROP FUNCTION IF EXISTS can_write_school_grades() CASCADE;
DROP FUNCTION IF EXISTS can_write_school_academic() CASCADE;
DROP FUNCTION IF EXISTS is_school_staff() CASCADE;
DROP FUNCTION IF EXISTS is_btp_org() CASCADE;
DROP FUNCTION IF EXISTS is_ngo_org() CASCADE;
DROP FUNCTION IF EXISTS is_school_org() CASCADE;
DROP FUNCTION IF EXISTS has_tenant_context() CASCADE;
DROP FUNCTION IF EXISTS belongs_to_org(UUID) CASCADE;
DROP FUNCTION IF EXISTS can_manage_finance() CASCADE;
DROP FUNCTION IF EXISTS can_manage_users() CASCADE;
DROP FUNCTION IF EXISTS is_org_admin() CASCADE;
DROP FUNCTION IF EXISTS has_role(app_role[]) CASCADE;
DROP FUNCTION IF EXISTS is_platform_admin() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_org_type() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_organization_id() CASCADE;
DROP FUNCTION IF EXISTS is_authenticated() CASCADE;
DROP FUNCTION IF EXISTS auth_uid() CASCADE;
DROP FUNCTION IF EXISTS assert_same_org_from_person() CASCADE;
DROP FUNCTION IF EXISTS sync_extraction_org_id() CASCADE;
DROP FUNCTION IF EXISTS update_stock_alert() CASCADE;
DROP FUNCTION IF EXISTS enforce_profile_org_for_role() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- Types v2
DROP TYPE IF EXISTS stock_alert_level CASCADE;
DROP TYPE IF EXISTS site_status CASCADE;
DROP TYPE IF EXISTS survey_status CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS enrollment_status CASCADE;
DROP TYPE IF EXISTS konascore_level CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS audit_action CASCADE;
DROP TYPE IF EXISTS document_category CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;
DROP TYPE IF EXISTS person_kind CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;
DROP TYPE IF EXISTS organization_type CASCADE;

-- Types v1 (ancien schéma)
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS subscription_plan CASCADE;

SELECT 'Reset terminé — exécutez maintenant full_schema.sql' AS message;
