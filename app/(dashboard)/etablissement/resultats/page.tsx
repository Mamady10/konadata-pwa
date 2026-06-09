import { getGrades, getSubjects, getClasses, getStudents } from '@/lib/actions/school';
import { getSchoolOrgSettings } from '@/lib/actions/school-settings';

import { getMyTeachingAssignments, canManageAssignments } from '@/lib/actions/assignments';

import { ResultatsClient } from './resultats-client';

import { personName } from '@/lib/school/person-utils';

import { redirect } from 'next/navigation';

import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';

import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { defaultGradingPeriodByLevel, type EducationLevelBand } from '@/lib/school/grading-period-settings';



export default async function ResultatsPage() {

  const session = await requireEtablissementPage('resultats');

  const caps = getEtablissementCapabilities(session.profile?.role);

  const orgId = session.profile?.organization_id;

  if (!orgId) redirect('/etablissement');



  const [teachingSlots, isDirector] = await Promise.all([

    getMyTeachingAssignments(),

    canManageAssignments(),

  ]);



  let grades: Record<string, unknown>[] = [];
  const loadErrors: string[] = [];

  let students: { id: string; full_name: string; matricule?: string; class_id?: string }[] = [];

  let subjects: {
    id: string;
    name: string;
    education_level_band?: EducationLevelBand | null;
  }[] = [];

  let classes: {
    id: string;
    name: string;
    level?: string | null;
    education_level_band?: EducationLevelBand | null;
  }[] = [];

  let allSubjects: {
    id: string;
    name: string;
    education_level_band?: EducationLevelBand | null;
  }[] = [];
  let gradingPeriodByLevel = defaultGradingPeriodByLevel();



  const slotKey = (classId: string, subjectId: string) => `${classId}:${subjectId}`;

  const allowedSlotKeys =

    teachingSlots === null ? null : new Set(teachingSlots.map((s) => slotKey(s.classId, s.subjectId)));

  const allowedClassIds =

    teachingSlots === null ? null : [...new Set(teachingSlots.map((s) => s.classId))];



  try {

    const [allGrades, allStudents, allSubjectsRaw, allClasses, { settings: schoolSettings }] =
      await Promise.all([
      getGrades(orgId),
      getStudents(orgId),
      getSubjects(orgId),
      getClasses(orgId),
      getSchoolOrgSettings(),
    ]);



    allSubjects = allSubjectsRaw.map((s) => ({
      id: s.id as string,
      name: s.name as string,
      education_level_band: (s.education_level_band as EducationLevelBand) || null,
    }));
    gradingPeriodByLevel = schoolSettings.grading_period_by_level;



    if (allowedSlotKeys === null) {

      classes = allClasses.map((c) => ({
        id: c.id as string,
        name: c.name as string,
        level: (c.level as string) || null,
        education_level_band: (c.education_level_band as EducationLevelBand) || null,
      }));

      subjects = allSubjects;

    } else {

      const classSet = new Set(allowedClassIds);

      classes = allClasses

        .filter((c) => classSet.has(c.id as string))

        .map((c) => ({
          id: c.id as string,
          name: c.name as string,
          level: (c.level as string) || null,
          education_level_band: (c.education_level_band as EducationLevelBand) || null,
        }));



      const subjectIdsForTeacher = new Set(teachingSlots!.map((s) => s.subjectId));

      subjects = allSubjects.filter((s) => subjectIdsForTeacher.has(s.id));

    }



    const allowedClassSet = allowedClassIds === null ? null : new Set(allowedClassIds);



    students = allStudents

      .filter((s) => {

        if (allowedClassSet === null) return true;

        const cid = s.class_id as string | null;

        return cid && allowedClassSet.has(cid);

      })

      .map((s) => ({

        id: s.id as string,

        full_name: personName(s),

        matricule: (s.matricule as string) || undefined,

        class_id: (s.class_id as string) || undefined,

      }));



    grades = allGrades.filter((g) => {

      if (allowedSlotKeys === null) return true;

      const cid = g.class_id as string | null;

      const sid = g.subject_id as string | null;

      return cid && sid && allowedSlotKeys.has(slotKey(cid, sid));

    });

  } catch (e) {
    loadErrors.push(
      e instanceof Error ? e.message : 'Impossible de charger les notes et le catalogue.'
    );
  }

  return (
    <ResultatsClient

      grades={grades}

      students={students}

      subjects={subjects}

      allSubjects={allSubjects}

      classes={classes}

      teachingSlots={teachingSlots ?? []}

      isDirector={isDirector}

      canEnterGrades={caps.enterGrades || isDirector}

      hasAssignments={teachingSlots === null || teachingSlots.length > 0}
      gradingPeriodByLevel={gradingPeriodByLevel}
      loadErrors={loadErrors}
    />

  );

}

