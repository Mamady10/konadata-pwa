-- ============================================================
-- KonaData F2 — Notes filtrées par assignation prof ↔ classe
-- Bulletins : écriture réservée aux directeurs (via app + RLS grades)
-- ============================================================

DROP POLICY IF EXISTS school_grades_select ON school_grades;
DROP POLICY IF EXISTS school_grades_write ON school_grades;
DROP POLICY IF EXISTS school_grades_update ON school_grades;
DROP POLICY IF EXISTS school_grades_delete ON school_grades;

CREATE POLICY school_grades_select ON school_grades FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR owns_school_student(student_id)
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_import_class(class_id)
      )
      OR (
        has_role('registrar', 'accountant')
        AND is_school_staff()
      )
    )
  );

CREATE POLICY school_grades_write ON school_grades FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_import_class(class_id)
      )
    )
  );

CREATE POLICY school_grades_update ON school_grades FOR UPDATE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_import_class(class_id)
      )
    )
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_import_class(class_id)
      )
    )
  );

CREATE POLICY school_grades_delete ON school_grades FOR DELETE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND is_org_admin()
  );

-- Bulletins : génération réservée aux directeurs
DROP POLICY IF EXISTS school_report_cards_write ON school_report_cards;
DROP POLICY IF EXISTS school_report_cards_update ON school_report_cards;
DROP POLICY IF EXISTS school_report_cards_delete ON school_report_cards;

CREATE POLICY school_report_cards_write ON school_report_cards FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org() AND is_org_admin()
  );

CREATE POLICY school_report_cards_update ON school_report_cards FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_org_admin())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND is_org_admin());

CREATE POLICY school_report_cards_delete ON school_report_cards FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_org_admin());
