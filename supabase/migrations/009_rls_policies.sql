-- ============================================================
-- KonaData v2 — Row Level Security (toutes les tables)
-- Aucune politique pour le rôle anon = accès public bloqué
-- ============================================================

-- ─── Activer RLS ───────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE konascore_snapshots ENABLE ROW LEVEL SECURITY;

-- ─── ORGANIZATIONS ─────────────────────────────────────────────

CREATE POLICY org_select ON organizations FOR SELECT TO authenticated
  USING (is_platform_admin() OR id = get_user_organization_id());

CREATE POLICY org_update ON organizations FOR UPDATE TO authenticated
  USING (is_org_admin() AND belongs_to_org(id))
  WITH CHECK (is_org_admin() AND belongs_to_org(id));

-- ─── PROFILES ────────────────────────────────────────────────────

CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR id = auth.uid()
    OR (organization_id = get_user_organization_id() AND has_tenant_context())
  );

CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_manage_org ON profiles FOR ALL TO authenticated
  USING (can_manage_users() AND belongs_to_org(organization_id))
  WITH CHECK (can_manage_users() AND belongs_to_org(organization_id));

-- ─── AUDIT & NOTIFICATIONS ───────────────────────────────────────

CREATE POLICY audit_select ON audit_logs FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));

CREATE POLICY audit_insert ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id));

CREATE POLICY notif_select ON notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND belongs_to_org(organization_id))
  );

CREATE POLICY notif_update ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notif_insert ON notifications FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

-- ─── Macro : tables scopées organisation ─────────────────────────

-- core_persons
CREATE POLICY core_persons_select ON core_persons FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));
CREATE POLICY core_persons_write ON core_persons FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND (is_org_admin() OR can_manage_users()));
CREATE POLICY core_persons_update ON core_persons FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND (is_org_admin() OR can_manage_users()))
  WITH CHECK (belongs_to_org(organization_id));
CREATE POLICY core_persons_delete ON core_persons FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());

-- documents
CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));
CREATE POLICY documents_insert ON documents FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND has_tenant_context());
CREATE POLICY documents_update ON documents FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id))
  WITH CHECK (belongs_to_org(organization_id));
CREATE POLICY documents_delete ON documents FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY extractions_all ON document_extractions FOR ALL TO authenticated
  USING (belongs_to_org(organization_id))
  WITH CHECK (belongs_to_org(organization_id));

-- konascore
CREATE POLICY konascore_select ON konascore_snapshots FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));
CREATE POLICY konascore_insert ON konascore_snapshots FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

-- ─── ÉCOLE ───────────────────────────────────────────────────────

CREATE POLICY school_classes_select ON school_classes FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_classes_write ON school_classes FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_subjects_select ON school_subjects FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_subjects_write ON school_subjects FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_teachers_select ON school_teachers FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_teachers_write ON school_teachers FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_users())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_manage_users());

CREATE POLICY school_students_select ON school_students FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (is_school_staff() OR owns_school_student(id))
  );
CREATE POLICY school_students_write ON school_students FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_enrollments_select ON school_enrollments FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());
CREATE POLICY school_enrollments_write ON school_enrollments FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_grades_select ON school_grades FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (is_school_staff() OR owns_school_student(student_id))
  );
CREATE POLICY school_grades_write ON school_grades FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_grades())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_grades());

CREATE POLICY school_payments_select ON school_payments FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (can_manage_finance() OR is_school_staff() OR owns_school_student(student_id))
  );
CREATE POLICY school_payments_write ON school_payments FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_finance())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_manage_finance());

CREATE POLICY school_schedules_select ON school_schedules FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_schedules_write ON school_schedules FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_student_docs_all ON school_student_documents FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());

CREATE POLICY school_report_cards_select ON school_report_cards FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (is_school_staff() OR owns_school_student(student_id))
  );
CREATE POLICY school_report_cards_write ON school_report_cards FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

-- ─── ONG ─────────────────────────────────────────────────────────

CREATE POLICY ngo_programs_all ON ngo_programs FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_projects_all ON ngo_projects FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_activities_all ON ngo_activities FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_indicators_all ON ngo_indicators FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_surveys_all ON ngo_surveys FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_survey_responses_all ON ngo_survey_responses FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_beneficiaries_all ON ngo_beneficiaries FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

-- ─── BTP ─────────────────────────────────────────────────────────

CREATE POLICY btp_sites_all ON btp_sites FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_contracts_all ON btp_contracts FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_personnel_all ON btp_personnel FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_equipment_all ON btp_equipment FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_stock_all ON btp_stock FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_delivery_notes_all ON btp_delivery_notes FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_fuel_logs_all ON btp_fuel_logs FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_daily_progress_all ON btp_daily_progress FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());
