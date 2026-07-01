'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/dashboard/data-table';
import {
  deleteScheduleSlot,
  getClassSchedule,
  saveScheduleSlot,
  type ScheduleSlotRow,
} from '@/lib/actions/school-schedules';
import {
  createAttendanceSession,
  listAttendanceSessions,
  type AttendanceSessionSummary,
} from '@/lib/actions/school-attendance';
import { SCHEDULE_DAYS, scheduleDayLabel } from '@/lib/school/schedule-utils';
import { CalendarDays, Clock, Megaphone, Plus, Trash2, UserCheck } from 'lucide-react';
import { SchoolAnnouncementsPanel } from '@/components/etablissement/school-announcements-panel';
import type { SchoolAnnouncementRow } from '@/lib/actions/school-announcements';

interface Props {
  classes: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string; class_id: string | null; matricule: string | null }>;
  initialClassId: string;
  initialSchedule: ScheduleSlotRow[];
  initialSessions: AttendanceSessionSummary[];
  initialAnnouncements: SchoolAnnouncementRow[];
  canManage: boolean;
}

export function VieScolaireClient({
  classes,
  subjects,
  teachers,
  students,
  initialClassId,
  initialSchedule,
  initialSessions,
  initialAnnouncements,
  canManage,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'actualites' | 'emploi' | 'presences'>('actualites');
  const [classId, setClassId] = useState(initialClassId);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [sessions, setSessions] = useState(initialSessions);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [slotForm, setSlotForm] = useState({
    subjectId: '',
    teacherId: '',
    dayOfWeek: '0',
    startTime: '08:00',
    endTime: '09:00',
    room: '',
  });

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, 'present' | 'absent'>>({});

  const classStudents = useMemo(
    () => students.filter((s) => s.class_id === classId),
    [students, classId]
  );

  useEffect(() => {
    const marks: Record<string, 'present' | 'absent'> = {};
    for (const s of classStudents) marks[s.id] = 'present';
    setAttendanceMarks(marks);
  }, [classStudents]);

  async function reloadClassData(nextClassId: string) {
    setClassId(nextClassId);
    setLoading(true);
    const [sched, sess] = await Promise.all([
      getClassSchedule(nextClassId),
      listAttendanceSessions(nextClassId),
    ]);
    setSchedule(Array.isArray(sched) ? sched : []);
    setSessions(Array.isArray(sess) ? sess : []);
    const marks: Record<string, 'present' | 'absent'> = {};
    for (const s of students.filter((st) => st.class_id === nextClassId)) {
      marks[s.id] = 'present';
    }
    setAttendanceMarks(marks);
    setLoading(false);
  }

  async function handleAddSlot() {
    if (!classId || !slotForm.subjectId) {
      setMsg('Choisissez une matière.');
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await saveScheduleSlot({
      classId,
      subjectId: slotForm.subjectId,
      teacherId: slotForm.teacherId || null,
      dayOfWeek: Number(slotForm.dayOfWeek),
      startTime: slotForm.startTime,
      endTime: slotForm.endTime,
      room: slotForm.room,
    });
    setLoading(false);
    if ('error' in res && res.error) setMsg(res.error);
    else {
      setMsg('Créneau enregistré.');
      router.refresh();
      const sched = await getClassSchedule(classId);
      setSchedule(Array.isArray(sched) ? sched : []);
    }
  }

  async function handleDeleteSlot(slotId: string) {
    setLoading(true);
    const res = await deleteScheduleSlot(slotId);
    setLoading(false);
    if ('error' in res && res.error) setMsg(res.error);
    else {
      setSchedule((rows) => rows.filter((r) => r.id !== slotId));
    }
  }

  async function handleSaveAttendance() {
    if (!classId) return;
    setLoading(true);
    setMsg(null);
    const records = classStudents.map((s) => ({
      studentId: s.id,
      status: attendanceMarks[s.id] ?? 'present',
    }));
    const res = await createAttendanceSession({
      classId,
      sessionDate: attendanceDate,
      records,
      source: 'manual',
    });
    setLoading(false);
    if ('error' in res && res.error) setMsg(res.error);
    else if ('saved' in res) {
      setMsg(`${res.saved} présence(s) enregistrée(s).`);
      const sess = await listAttendanceSessions(classId);
      setSessions(Array.isArray(sess) ? sess : []);
      router.refresh();
    }
  }

  const scheduleRows = schedule.map((s) => ({
    id: s.id,
    jour: scheduleDayLabel(s.day_of_week),
    horaire: `${s.start_time} – ${s.end_time}`,
    matiere: s.subject_name,
    enseignant: s.teacher_name ?? '—',
    salle: s.room ?? '—',
  }));

  const sessionRows = sessions.map((s) => ({
    id: s.id,
    date: s.session_date,
    classe: s.class_name,
    presents: s.present_count,
    absents: s.absent_count,
    source: s.source === 'capture' ? 'Scan KonaData' : 'Manuel',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" />
          Vie scolaire
        </h1>
        <p className="text-muted-foreground">
          Actualités, emploi du temps et présences — partagé avec les parents via le portail suivi scolarité.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === 'actualites' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('actualites')}
        >
          <Megaphone className="h-4 w-4 mr-1" />
          Actualités
        </Button>
        <Button
          variant={tab === 'emploi' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('emploi')}
        >
          <Clock className="h-4 w-4 mr-1" />
          Emploi du temps
        </Button>
        <Button
          variant={tab === 'presences' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('presences')}
        >
          <UserCheck className="h-4 w-4 mr-1" />
          Présences
        </Button>
      </div>

      {tab === 'actualites' && (
        <SchoolAnnouncementsPanel announcements={initialAnnouncements} canManage={canManage} />
      )}

      {tab !== 'actualites' && (
      <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Classe</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={classId} onValueChange={(v) => reloadClassData(v)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {tab === 'emploi' && (
        <>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ajouter un créneau</CardTitle>
                <CardDescription>Matière, jour et horaire pour la classe sélectionnée.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>Matière</Label>
                  <Select
                    value={slotForm.subjectId}
                    onValueChange={(v) => setSlotForm((f) => ({ ...f, subjectId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Enseignant (optionnel)</Label>
                  <Select
                    value={slotForm.teacherId || '__none'}
                    onValueChange={(v) =>
                      setSlotForm((f) => ({ ...f, teacherId: v === '__none' ? '' : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Jour</Label>
                  <Select
                    value={slotForm.dayOfWeek}
                    onValueChange={(v) => setSlotForm((f) => ({ ...f, dayOfWeek: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_DAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Début</Label>
                  <Input
                    type="time"
                    value={slotForm.startTime}
                    onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input
                    type="time"
                    value={slotForm.endTime}
                    onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Salle</Label>
                  <Input
                    value={slotForm.room}
                    onChange={(e) => setSlotForm((f) => ({ ...f, room: e.target.value }))}
                    placeholder="Ex. A12"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button onClick={handleAddSlot} disabled={loading} className="bg-[#2563EB]">
                    <Plus className="h-4 w-4" />
                    Ajouter le créneau
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <DataTable
            title={`Emploi du temps — ${classes.find((c) => c.id === classId)?.name ?? ''}`}
            data={scheduleRows}
            columns={[
              { key: 'jour', label: 'Jour' },
              { key: 'horaire', label: 'Horaire' },
              { key: 'matiere', label: 'Matière' },
              { key: 'enseignant', label: 'Enseignant' },
              { key: 'salle', label: 'Salle' },
              ...(canManage
                ? [
                    {
                      key: 'id',
                      label: '',
                      render: (row: { id: string }) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={loading}
                          onClick={() => handleDeleteSlot(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      {tab === 'presences' && (
        <>
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saisie rapide</CardTitle>
                <CardDescription>
                  Marquez les absents — les autres sont considérés présents. Les scans KonaData
                  s&apos;enregistrent aussi via Rapports → registre de présence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 max-w-xs">
                  <Label>Date de séance</Label>
                  <Input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {classStudents.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        {s.name}
                        {s.matricule && (
                          <span className="text-xs text-muted-foreground ml-1 font-mono">
                            {s.matricule}
                          </span>
                        )}
                      </span>
                      <Select
                        value={attendanceMarks[s.id] ?? 'present'}
                        onValueChange={(v) =>
                          setAttendanceMarks((m) => ({
                            ...m,
                            [s.id]: v as 'present' | 'absent',
                          }))
                        }
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Présent</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  ))}
                </div>
                {classStudents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun élève inscrit dans cette classe.</p>
                )}
                <Button
                  onClick={handleSaveAttendance}
                  disabled={loading || !classStudents.length}
                  className="bg-[#2563EB]"
                >
                  Enregistrer la séance
                </Button>
              </CardContent>
            </Card>
          )}

          <DataTable
            title="Historique des séances"
            data={sessionRows}
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'classe', label: 'Classe' },
              { key: 'presents', label: 'Présents' },
              { key: 'absents', label: 'Absents' },
              {
                key: 'source',
                label: 'Source',
                render: (row: { source: string }) => (
                  <Badge variant={row.source.includes('Scan') ? 'secondary' : 'outline'}>
                    {row.source}
                  </Badge>
                ),
              },
            ]}
          />
        </>
      )}
      </>
      )}

      {msg && <p className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
