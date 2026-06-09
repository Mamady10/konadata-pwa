'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  listPublicSchools,
  getSchoolApplicationCatalog,
  applyToSchoolAsLearner,
} from '@/lib/actions/learner-onboarding';
import {
  formatSchoolClassLabel,
  type PublicSchoolOption,
  type SchoolApplicationCatalog,
} from '@/lib/school/learner-application';
import {
  findDuplicateSchoolNameKeys,
  formatPublicSchoolLabel,
  normalizeSchoolOrgName,
} from '@/lib/school/org-name';
import { Database, ArrowRight, ArrowLeft, GraduationCap, Building2, AlertCircle } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;
type RequestType = 'new' | 'reenrollment';

interface InscriptionWizardProps {
  isNewApplication?: boolean;
}

export function InscriptionWizard({ isNewApplication = false }: InscriptionWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [schools, setSchools] = useState<PublicSchoolOption[]>([]);
  const [catalog, setCatalog] = useState<SchoolApplicationCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [schoolId, setSchoolId] = useState('');
  const [studyLevel, setStudyLevel] = useState('');
  const [department, setDepartment] = useState('');
  const [program, setProgram] = useState('');
  const [classId, setClassId] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('new');
  const [reenrollmentCode, setReenrollmentCode] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianSmsConsent, setGuardianSmsConsent] = useState(false);

  useEffect(() => {
    listPublicSchools().then(setSchools);
  }, []);

  useEffect(() => {
    if (!schoolId) {
      setCatalog(null);
      return;
    }
    setStudyLevel('');
    setDepartment('');
    setProgram('');
    setClassId('');
    setLoading(true);
    getSchoolApplicationCatalog(schoolId).then((c) => {
      setCatalog(c);
      setLoading(false);
    });
  }, [schoolId]);

  function onSelectClass(id: string) {
    setClassId(id);
    const c = catalog?.classes.find((x) => x.id === id);
    if (c) {
      setStudyLevel(c.level || '');
      setDepartment(c.department || '');
      setProgram(c.program || '');
    }
  }

  const selectedClass = catalog?.classes.find((c) => c.id === classId);

  const filteredClasses = useMemo(() => {
    if (!catalog?.classes) return [];
    return catalog.classes.filter((c) => {
      if (studyLevel && c.level && c.level !== studyLevel) return false;
      if (department && c.department && c.department !== department) return false;
      if (program && c.program && c.program !== program) return false;
      return true;
    });
  }, [catalog, studyLevel, department, program]);

  const selectedSchool = schools.find((s) => s.id === schoolId);
  const duplicateNameKeys = useMemo(() => findDuplicateSchoolNameKeys(schools), [schools]);
  const selectedSchoolHasDuplicateName = selectedSchool
    ? duplicateNameKeys.has(normalizeSchoolOrgName(selectedSchool.name))
    : false;

  async function handleSubmit() {
    setError(null);

    if (!schoolId) {
      setError('Choisissez un établissement à l’étape 1.');
      return;
    }

    if (catalog?.hasClasses && !classId) {
      setError('Choisissez une classe proposée par l’établissement.');
      return;
    }

    if (!catalog?.hasClasses) {
      setError(
        'Cet établissement n’a pas encore publié de classes. Contactez la scolarité ou réessayez plus tard.'
      );
      return;
    }

    if (requestType === 'reenrollment' && reenrollmentCode.trim().length < 4) {
      setError('Saisissez le code de réinscription fourni par votre établissement.');
      return;
    }

    setLoading(true);

    try {
      if (!guardianPhone.trim()) {
        setError('Indiquez le téléphone du tuteur ou responsable des paiements.');
        setLoading(false);
        return;
      }

      const result = await applyToSchoolAsLearner({
        organizationId: schoolId,
        studyLevel,
        department,
        program,
        classId: classId || null,
        requestType,
        reenrollmentCode: requestType === 'reenrollment' ? reenrollmentCode : null,
        guardianName: guardianName.trim() || null,
        guardianPhone: guardianPhone.trim(),
        guardianRelation: guardianRelation.trim() || null,
        guardianSmsConsent,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result?.success) {
        setError('La demande n’a pas été enregistrée. Réessayez ou contactez l’établissement.');
        setLoading(false);
        return;
      }

      window.location.href = '/etablissement/candidatures';
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Erreur inattendue. Vérifiez votre connexion et réessayez.'
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <div className="w-full max-w-xl">
        <div className="mb-6">
          <AuthBackHome />
        </div>

        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold">KonaData</span>
        </div>

        <Card className="border-0 shadow-card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Inscription candidat / élève
            </CardTitle>
            <CardDescription>
              {isNewApplication
                ? `Étape ${step} sur 4 — nouvelle demande (même établissement ou un autre)`
                : `Étape ${step} sur 4 — choisissez votre établissement et votre filière`}
            </CardDescription>
            <div className="flex gap-1 pt-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-[#2563EB]' : 'bg-muted'}`}
                />
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {step === 1 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez l&apos;établissement où vous souhaitez vous inscrire ou vous réinscrire.
                </p>
                {schools.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Aucun établissement ouvert aux candidatures pour le moment.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label>Établissement *</Label>
                    <Select value={schoolId} onValueChange={setSchoolId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un établissement" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {formatPublicSchoolLabel(s)}
                            {duplicateNameKeys.has(normalizeSchoolOrgName(s.name))
                              ? ' ⚠ même nom'
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSchoolHasDuplicateName && selectedSchool && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        Plusieurs établissements portent le nom « {selectedSchool.name} ». Vérifiez la
                        ville ou l&apos;email :{' '}
                        {selectedSchool.email || 'non renseigné'} — {selectedSchool.city || 'ville non renseignée'}.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    disabled={!schoolId}
                    onClick={() => setStep(2)}
                    className="bg-[#2563EB]"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                {selectedSchool && (
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {selectedSchool.name}
                  </p>
                )}
                {loading && (
                  <p className="text-sm text-muted-foreground">Chargement des classes de l&apos;établissement…</p>
                )}
                {catalog?.error && (
                  <p className="text-sm text-destructive">{catalog.error}</p>
                )}
                {!loading && catalog && !catalog.hasClasses && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Cet établissement n&apos;a pas encore créé de classes dans Formations. La scolarité doit
                    d&apos;abord les configurer (nom, niveau, département, filière) avant que vous puissiez
                    poursuivre.
                  </p>
                )}
                {!loading && catalog?.hasClasses && (
                  <div className="grid gap-4">
                    {(catalog.levels.length > 1 ||
                      catalog.departments.length > 1 ||
                      catalog.programs.length > 1) && (
                      <p className="text-xs text-muted-foreground">
                        Filtres optionnels pour affiner la liste des classes.
                      </p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {catalog.levels.length > 1 && (
                        <div className="space-y-2">
                          <Label>Filtrer par niveau</Label>
                          <Select
                            value={studyLevel || '__all__'}
                            onValueChange={(v) => {
                              setStudyLevel(v === '__all__' ? '' : v);
                              setClassId('');
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Tous les niveaux</SelectItem>
                              {catalog.levels.map((l) => (
                                <SelectItem key={l} value={l}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {catalog.departments.length > 1 && (
                        <div className="space-y-2">
                          <Label>Filtrer par département</Label>
                          <Select
                            value={department || '__all__'}
                            onValueChange={(v) => {
                              setDepartment(v === '__all__' ? '' : v);
                              setClassId('');
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Tous les départements</SelectItem>
                              {catalog.departments.map((d) => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {catalog.programs.length > 1 && (
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Filtrer par filière</Label>
                          <Select
                            value={program || '__all__'}
                            onValueChange={(v) => {
                              setProgram(v === '__all__' ? '' : v);
                              setClassId('');
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Toutes les filières</SelectItem>
                              {catalog.programs.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Classe *</Label>
                        <Select value={classId} onValueChange={onSelectClass}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une classe de l'établissement" />
                          </SelectTrigger>
                          <SelectContent>
                            {(filteredClasses.length ? filteredClasses : catalog.classes).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {formatSchoolClassLabel(c)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {selectedClass && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                        <p><strong>Classe :</strong> {selectedClass.name}</p>
                        {selectedClass.level && <p><strong>Niveau :</strong> {selectedClass.level}</p>}
                        {selectedClass.department && (
                          <p><strong>Département :</strong> {selectedClass.department}</p>
                        )}
                        {selectedClass.program && <p><strong>Filière :</strong> {selectedClass.program}</p>}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                  <Button
                    disabled={loading || !catalog?.hasClasses || !classId}
                    onClick={() => setStep(3)}
                    className="bg-[#2563EB]"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Indiquez s&apos;il s&apos;agit d&apos;une première inscription ou d&apos;une réinscription.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={requestType === 'new' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setRequestType('new')}
                  >
                    Nouvelle inscription
                  </Button>
                  <Button
                    type="button"
                    variant={requestType === 'reenrollment' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setRequestType('reenrollment')}
                  >
                    Réinscription
                  </Button>
                </div>
                {requestType === 'reenrollment' && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <Label htmlFor="rein-code">Code de réinscription *</Label>
                    <Input
                      id="rein-code"
                      value={reenrollmentCode}
                      onChange={(e) => setReenrollmentCode(e.target.value.toUpperCase())}
                      placeholder="Ex. REIN-2024-042"
                      className="uppercase font-mono bg-white"
                    />
                    <p className="text-xs text-amber-900">
                      Code communiqué par la scolarité pour confirmer votre ancienne inscription dans
                      leur base. La scolarité pourra vérifier ce code dans votre dossier.
                    </p>
                  </div>
                )}

                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Tuteur / responsable des paiements</p>
                  <p className="text-xs text-muted-foreground">
                    Numéro utilisé pour les rappels SMS selon l&apos;échéancier de scolarité.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="guardian-name">Nom du tuteur</Label>
                      <Input
                        id="guardian-name"
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="Ex. Mamadou Diallo"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="guardian-phone">Téléphone tuteur *</Label>
                      <Input
                        id="guardian-phone"
                        value={guardianPhone}
                        onChange={(e) => setGuardianPhone(e.target.value)}
                        placeholder="6XX XX XX XX"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="guardian-rel">Lien de parenté</Label>
                      <Input
                        id="guardian-rel"
                        value={guardianRelation}
                        onChange={(e) => setGuardianRelation(e.target.value)}
                        placeholder="Père, mère, oncle…"
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianSmsConsent}
                      onChange={(e) => setGuardianSmsConsent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      J&apos;accepte de recevoir des rappels de paiement par SMS sur ce numéro (selon
                      les dates limites de l&apos;établissement).
                    </span>
                  </label>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                  <Button
                    disabled={
                      (requestType === 'reenrollment' && reenrollmentCode.trim().length < 4) ||
                      !guardianPhone.trim()
                    }
                    onClick={() => setStep(4)}
                    className="bg-[#2563EB]"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                  <p><strong>Établissement :</strong> {selectedSchool && formatPublicSchoolLabel(selectedSchool)}</p>
                  {selectedClass && <p><strong>Classe :</strong> {selectedClass.name}</p>}
                  {studyLevel && <p><strong>Niveau :</strong> {studyLevel}</p>}
                  {department && <p><strong>Département :</strong> {department}</p>}
                  {program && <p><strong>Filière :</strong> {program}</p>}
                  <p>
                    <strong>Demande :</strong>{' '}
                    {requestType === 'new' ? 'Nouvelle inscription' : 'Réinscription'}
                  </p>
                  {requestType === 'reenrollment' && (
                    <p>
                      <strong>Code :</strong>{' '}
                      <span className="font-mono">{reenrollmentCode}</span>
                    </p>
                  )}
                  {guardianPhone && (
                    <p>
                      <strong>Tuteur :</strong> {guardianName || '—'} · {guardianPhone}
                      {guardianRelation ? ` (${guardianRelation})` : ''}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Après validation, vous pourrez déposer vos pièces (CNI, bulletins, etc.) sur la page
                  candidatures.
                </p>
                {error && step === 4 && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(3)} disabled={loading}>
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={loading || !schoolId}
                    className="bg-[#2563EB]"
                  >
                    {loading ? 'Envoi…' : 'Confirmer ma demande'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link href={LANDING_LINKS.registerLearner} className="text-primary font-medium hover:underline">
            Créer un compte candidat
          </Link>
        </p>
      </div>
    </div>
  );
}
