'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, FolderKanban, GraduationCap, HardHat, Save, Users } from 'lucide-react';
import type { OrganizationType } from '@/types/database';
import { ROLE_LABELS } from '@/types/database';
import type { BtpAssignmentsPayload, NgoAssignmentsPayload, SchoolAssignmentsPayload } from '@/lib/actions/assignments';
import {
  parseEducationLevelBand,
  subjectMatchesClassBand,
} from '@/lib/school/education-level-catalog';
import {
  EDUCATION_LEVEL_BANDS,
  educationLevelBandLabel,
} from '@/lib/school/grading-period-settings';
import {
  saveBtpStaffSiteAssignments,
  saveNgoStaffProjectAssignments,
  saveTeacherTeachingAssignments,
} from '@/lib/actions/assignments';

interface Props {
  orgName: string;
  orgType: OrganizationType;
  schoolData: SchoolAssignmentsPayload | null;
  ngoData: NgoAssignmentsPayload | null;
  btpData: BtpAssignmentsPayload | null;
  canManage: boolean;
}

export function AssignationsClient({ orgName, orgType, schoolData, ngoData, btpData, canManage }: Props) {
  const moduleType =
    orgType === 'btp' || (orgType as string) === 'construction' ? 'btp' : orgType;

  const router = useRouter();
  const [schoolDraft, setSchoolDraft] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    schoolData?.teachers.forEach((t) => {
      const keys = (t.teachingSlots ?? []).map((s) => `${s.classId}:${s.subjectId}`);
      initial[t.id] = new Set(keys);
    });
    return initial;
  });
  const [ngoDraft, setNgoDraft] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    ngoData?.staff.forEach((s) => {
      initial[s.id] = [...s.projectIds];
    });
    return initial;
  });
  const [btpDraft, setBtpDraft] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    btpData?.staff.forEach((s) => {
      initial[s.id] = [...s.siteIds];
    });
    return initial;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!schoolData?.teachers) return;
    const next: Record<string, Set<string>> = {};
    schoolData.teachers.forEach((t) => {
      const keys = (t.teachingSlots ?? []).map((s) => `${s.classId}:${s.subjectId}`);
      next[t.id] = new Set(keys);
    });
    setSchoolDraft(next);
  }, [schoolData]);

  function toggleTeachingSlot(
    teacherId: string,
    classId: string,
    subjectId: string,
    checked: boolean
  ) {
    const key = `${classId}:${subjectId}`;
    setSchoolDraft((prev) => {
      const current = new Set(prev[teacherId] ?? []);
      if (checked) current.add(key);
      else current.delete(key);
      return { ...prev, [teacherId]: current };
    });
  }

  function toggleNgoProject(staffId: string, projectId: string, checked: boolean) {
    setNgoDraft((prev) => {
      const current = new Set(prev[staffId] ?? []);
      if (checked) current.add(projectId);
      else current.delete(projectId);
      return { ...prev, [staffId]: [...current] };
    });
  }

  function toggleBtpSite(staffId: string, siteId: string, checked: boolean) {
    setBtpDraft((prev) => {
      const current = new Set(prev[staffId] ?? []);
      if (checked) current.add(siteId);
      else current.delete(siteId);
      return { ...prev, [staffId]: [...current] };
    });
  }

  async function handleSaveSchool(teacherId: string) {
    setSavingId(teacherId);
    setMessage(null);
    const keys = [...(schoolDraft[teacherId] ?? [])];
    const slots = keys.map((key) => {
      const [classId, subjectId] = key.split(':');
      return { classId, subjectId };
    });
    const result = await saveTeacherTeachingAssignments(teacherId, slots);
    if (result.error) setMessage({ type: 'err', text: result.error });
    else {
      setMessage({ type: 'ok', text: 'Assignations enregistrées.' });
      router.refresh();
    }
    setSavingId(null);
  }

  async function handleSaveNgo(staffId: string) {
    setSavingId(staffId);
    setMessage(null);
    const result = await saveNgoStaffProjectAssignments(staffId, ngoDraft[staffId] ?? []);
    if (result.error) setMessage({ type: 'err', text: result.error });
    else {
      setMessage({ type: 'ok', text: 'Assignations enregistrées.' });
      router.refresh();
    }
    setSavingId(null);
  }

  async function handleSaveBtp(staffId: string) {
    setSavingId(staffId);
    setMessage(null);
    const result = await saveBtpStaffSiteAssignments(staffId, btpDraft[staffId] ?? []);
    if (result.error) setMessage({ type: 'err', text: result.error });
    else {
      setMessage({ type: 'ok', text: 'Assignations enregistrées.' });
      router.refresh();
    }
    setSavingId(null);
  }

  if (moduleType === 'btp') {
    const { sites, staff } = btpData ?? { sites: [], staff: [] };

    return (
      <div className="space-y-6">
        <Header orgName={orgName} />

        {message && (
          <p className={`text-sm rounded-lg p-3 ${message.type === 'ok' ? 'bg-emerald-500/10 text-emerald-800' : 'bg-destructive/10 text-destructive'}`}>
            {message.text}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              Staff ↔ Chantiers (BTP)
            </CardTitle>
            <CardDescription>
              Choisissez les chantiers que chaque collaborateur peut suivre (carburant, avancement terrain).
              Les directeurs voient tous les chantiers et les rapports globaux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sites.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun chantier. Créez des chantiers dans{' '}
                <Link href="/btp/chantiers" className="text-primary underline">Chantiers</Link>.
              </p>
            )}

            {staff.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun staff invité. Générez un code « Staff BTP » dans{' '}
                <Link href="/utilisateurs" className="text-primary underline">Utilisateurs</Link>.
              </p>
            )}

            {staff.map((member) => (
              <div key={member.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
                </div>

                {sites.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sites.map((site) => {
                      const checked = (btpDraft[member.id] ?? []).includes(site.id);
                      return (
                        <label
                          key={site.id}
                          className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                            checked={checked}
                            onChange={(e) => toggleBtpSite(member.id, site.id, e.target.checked)}
                            disabled={!canManage || savingId === member.id}
                          />
                          <span className="text-sm">
                            <span className="font-medium">{site.name}</span>
                            {site.location && (
                              <span className="block text-xs text-muted-foreground">{site.location}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => handleSaveBtp(member.id)}
                    disabled={savingId === member.id}
                    className="bg-[#2563EB] hover:bg-[#2563EB]/90"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === member.id ? 'Enregistrement…' : 'Enregistrer pour ce collaborateur'}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (moduleType === 'ngo') {
    const { projects, staff } = ngoData ?? { projects: [], staff: [] };

    return (
      <div className="space-y-6">
        <Header orgName={orgName} />

        {message && (
          <p className={`text-sm rounded-lg p-3 ${message.type === 'ok' ? 'bg-emerald-500/10 text-emerald-800' : 'bg-destructive/10 text-destructive'}`}>
            {message.text}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              Agents ↔ Projets
            </CardTitle>
            <CardDescription>
              Choisissez les projets que chaque agent peut suivre et documenter (upload de rapports).
              Les directeurs voient tous les projets et peuvent générer les rapports globaux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun projet. Créez des projets dans{' '}
                <Link href="/ong/projets" className="text-primary underline">Projets</Link>.
              </p>
            )}

            {staff.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun agent invité. Générez un code « Staff ONG » dans{' '}
                <Link href="/utilisateurs" className="text-primary underline">Utilisateurs</Link>.
              </p>
            )}

            {staff.map((member) => (
              <div key={member.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
                </div>

                {projects.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => {
                      const checked = (ngoDraft[member.id] ?? []).includes(project.id);
                      return (
                        <label
                          key={project.id}
                          className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                            checked={checked}
                            onChange={(e) => toggleNgoProject(member.id, project.id, e.target.checked)}
                            disabled={!canManage || savingId === member.id}
                          />
                          <span className="text-sm">
                            <span className="font-medium">{project.name}</span>
                            {project.region && (
                              <span className="block text-xs text-muted-foreground">{project.region}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => handleSaveNgo(member.id)}
                    disabled={savingId === member.id}
                    className="bg-[#2563EB] hover:bg-[#2563EB]/90"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === member.id ? 'Enregistrement…' : 'Enregistrer pour cet agent'}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { classes, subjects, teachers } = schoolData ?? { classes: [], subjects: [], teachers: [] };

  const allAssignedKeys = new Set<string>();
  teachers.forEach((t) => {
    (t.teachingSlots ?? []).forEach((s) => allAssignedKeys.add(`${s.classId}:${s.subjectId}`));
  });

  const unassignedPairs: { className: string; subjectName: string; bandLabel: string }[] = [];
  for (const cls of classes) {
    const classBand = parseEducationLevelBand(cls.education_level_band);
    const matchingSubjects = subjects.filter((sub) =>
      subjectMatchesClassBand(
        parseEducationLevelBand(sub.education_level_band),
        classBand,
        cls.level
      )
    );
    for (const sub of matchingSubjects) {
      const key = `${cls.id}:${sub.id}`;
      if (!allAssignedKeys.has(key)) {
        unassignedPairs.push({
          className: cls.name,
          subjectName: sub.name,
          bandLabel: educationLevelBandLabel(classBand ?? 'college'),
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <Header orgName={orgName} />

      {message && (
        <p className={`text-sm rounded-lg p-3 ${message.type === 'ok' ? 'bg-emerald-500/10 text-emerald-800' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Professeurs ↔ Classes ↔ Matières
          </CardTitle>
          <CardDescription>
            Cochez pour chaque enseignant les couples classe + matière qu&apos;il enseigne (saisie des notes).
            Les directeurs voient toutes les notes et peuvent filtrer par matière.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {classes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune classe active. Créez des classes dans{' '}
              <Link href="/etablissement/formations" className="text-primary underline">Formations</Link>.
            </p>
          )}

          {subjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune matière. Créez des matières dans{' '}
              <Link href="/etablissement/formations" className="text-primary underline">Formations</Link>.
            </p>
          )}

          {teachers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun enseignant invité. Générez un code « Enseignant » dans{' '}
              <Link href="/utilisateurs" className="text-primary underline">Utilisateurs</Link>.
            </p>
          )}

          {unassignedPairs.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                {unassignedPairs.length} couple{unassignedPairs.length > 1 ? 's' : ''} classe/matière sans enseignant
              </p>
              <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                {unassignedPairs.slice(0, 12).map((p, i) => (
                  <li key={`${p.className}-${p.subjectName}-${i}`}>
                    {p.bandLabel} · {p.className} — {p.subjectName}
                  </li>
                ))}
                {unassignedPairs.length > 12 && (
                  <li>… et {unassignedPairs.length - 12} autre(s)</li>
                )}
              </ul>
            </div>
          )}

          {teachers.map((teacher) => (
            <div key={teacher.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{teacher.full_name}</p>
                  <p className="text-xs text-muted-foreground">{teacher.email}</p>
                </div>
                <Badge variant="outline">{ROLE_LABELS[teacher.role] ?? teacher.role}</Badge>
              </div>

              {classes.length > 0 && subjects.length > 0 && (
                <div className="space-y-4">
                  {EDUCATION_LEVEL_BANDS.map((band) => {
                    const bandClasses = classes.filter(
                      (c) =>
                        parseEducationLevelBand(c.education_level_band) === band.id ||
                        (!c.education_level_band && band.id === 'college')
                    );
                    if (bandClasses.length === 0) return null;
                    return (
                      <div key={band.id} className="space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">{band.label}</p>
                        {bandClasses.map((cls) => (
                          <div key={cls.id} className="rounded-md border p-3 space-y-2">
                            <p className="text-sm font-medium">
                              {cls.name}
                              {cls.level && (
                                <span className="text-muted-foreground font-normal"> — {cls.level}</span>
                              )}
                              {cls.education_level_band && (
                                <span className="text-muted-foreground font-normal">
                                  {' '}
                                  · {educationLevelBandLabel(parseEducationLevelBand(cls.education_level_band) ?? 'college')}
                                </span>
                              )}
                              <span className="block text-xs text-muted-foreground font-normal">
                                {cls.academic_year}
                              </span>
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {subjects
                                .filter((sub) =>
                                  subjectMatchesClassBand(
                                    parseEducationLevelBand(sub.education_level_band),
                                    parseEducationLevelBand(cls.education_level_band),
                                    cls.level
                                  )
                                )
                                .map((sub) => {
                                  const key = `${cls.id}:${sub.id}`;
                                  const checked = (schoolDraft[teacher.id] ?? new Set()).has(key);
                                  return (
                                    <label
                                      key={key}
                                      className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 rounded border-gray-300"
                                        checked={checked}
                                        onChange={(e) =>
                                          toggleTeachingSlot(teacher.id, cls.id, sub.id, e.target.checked)
                                        }
                                        disabled={!canManage || savingId === teacher.id}
                                      />
                                      <span className="text-sm">
                                        <span className="font-medium">{sub.name}</span>
                                        {sub.code && (
                                          <span className="block text-xs text-muted-foreground">{sub.code}</span>
                                        )}
                                      </span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {canManage && (
                <Button
                  size="sm"
                  onClick={() => handleSaveSchool(teacher.id)}
                  disabled={savingId === teacher.id}
                  className="bg-[#2563EB] hover:bg-[#2563EB]/90"
                >
                  <Save className="h-4 w-4" />
                  {savingId === teacher.id ? 'Enregistrement…' : 'Enregistrer pour cet enseignant'}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Header({ orgName }: { orgName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Link href="/utilisateurs" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Assignations</h1>
        </div>
        <p className="text-muted-foreground mt-1">{orgName} — périmètres des collaborateurs</p>
      </div>
      <Badge variant="secondary" className="gap-1">
        <Users className="h-3 w-3" />
        Directeurs
      </Badge>
    </div>
  );
}
