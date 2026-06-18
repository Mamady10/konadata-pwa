'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyRound, Copy, Ban, Users, Mail, GraduationCap, FolderKanban, HardHat, ShieldAlert, UserX, UserCheck } from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';
import type { AppRole, OrganizationType } from '@/types/database';
import type { AccessCodeRow, AccessCodesIssueStatus } from '@/lib/actions/access-codes';
import { generateAccessCode, revokeAccessCode, sendAccessCodeByEmail } from '@/lib/actions/access-codes';
import { setMemberAccessActive } from '@/lib/actions/member-access';
import { INVITE_ROLES_BY_ORG } from '@/lib/sector/invite-roles';
import { canDirectorResetMemberCredentials } from '@/lib/auth/member-credentials-policy';
import {
  MemberCredentialsResetPanel,
  type MemberCredentialsRow,
} from '@/components/auth/member-credentials-reset-panel';

interface UserRow extends MemberCredentialsRow {
  isPhoneAccount: boolean;
  isActive: boolean;
  status: string;
  lastLogin: string;
}

interface Props {
  users: UserRow[];
  orgName: string;
  orgType: OrganizationType;
  accessCodes: AccessCodeRow[];
  canIssueCodes: boolean;
  issueStatus?: AccessCodesIssueStatus;
  responsablesCount: number;
  isOrgAdmin: boolean;
  actorRole: AppRole;
  actorId: string;
}

function schoolInviteRoles(orgType: OrganizationType, isOrgAdmin: boolean) {
  const base = INVITE_ROLES_BY_ORG[orgType] ?? INVITE_ROLES_BY_ORG.school;
  return base.filter((r) => r.value !== 'deputy_director' || isOrgAdmin);
}

export function UtilisateursClient({
  users,
  orgName,
  orgType,
  accessCodes,
  canIssueCodes,
  issueStatus,
  responsablesCount,
  isOrgAdmin,
  actorRole,
  actorId,
}: Props) {
  const router = useRouter();
  const inviteRoles = schoolInviteRoles(orgType, isOrgAdmin);
  const defaultRole = inviteRoles[0]?.value ?? 'teacher';
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [infoTone, setInfoTone] = useState<'success' | 'warning'>('success');
  const [role, setRole] = useState<AppRole>(defaultRole);
  const [copied, setCopied] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  function memberCanManage(user: UserRow): boolean {
    return canDirectorResetMemberCredentials(actorRole, user.role, actorId, user.id);
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setGeneratedCode(null);
    setGenerating(true);
    try {
    const formData = new FormData(e.currentTarget);
    formData.set('role', role);
    const result = await generateAccessCode(formData);
    if (!result) {
      setError('Erreur serveur (aucune réponse). Rechargez la page ou consultez la console du navigateur (F12).');
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.code) setGeneratedCode(result.code);
    if (result.emailSent) {
      setInfoTone('success');
      setInfo('Code généré et envoyé par email.');
    } else if (result.emailWarning) {
      setInfoTone('warning');
      setInfo(`Code généré, mais email non envoyé : ${result.emailWarning}`);
    } else if (result.code) {
      setInfoTone('success');
      setInfo('Code généré — copiez-le ou saisissez un email.');
    }
    router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  }

  async function handleResend(codeId: string) {
    setError(null);
    setInfo(null);
    const email = resendEmail[codeId]?.trim();
    if (!email) {
      setError('Saisissez un email pour renvoyer le code.');
      return;
    }
    const fd = new FormData();
    fd.set('code_id', codeId);
    fd.set('recipient_email', email);
    const result = await sendAccessCodeByEmail(fd);
    if (result.error) setError(result.error);
    else if (result.emailSent) {
      setInfoTone('success');
      setInfo(`Code renvoyé à ${email}`);
    } else {
      setInfoTone('warning');
      setInfo(result.emailWarning ?? 'Email non envoyé');
    }
    router.refresh();
  }

  async function handleRevoke(id: string) {
    await revokeAccessCode(id);
    router.refresh();
  }

  async function handleToggleAccess(user: UserRow, active: boolean) {
    const verb = active ? 'réactiver' : 'bloquer';
    const detail = active
      ? `Réactiver l'accès de ${user.name} ?`
      : `Bloquer l'accès de ${user.name} ? La personne ne pourra plus se connecter (ex. changement de professeur, fin de collaboration).`;
    if (!window.confirm(detail)) return;

    setError(null);
    setInfo(null);
    setTogglingUserId(user.id);
    try {
      const fd = new FormData();
      fd.set('target_user_id', user.id);
      fd.set('active', active ? 'true' : 'false');
      const result = await setMemberAccessActive(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfoTone('success');
      setInfo(result.message ?? (active ? 'Accès réactivé.' : 'Accès bloqué.'));
      router.refresh();
    } finally {
      setTogglingUserId(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground">
            {orgName} — {users.length} membre{users.length !== 1 ? 's' : ''} · {responsablesCount}/2 responsable{responsablesCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canIssueCodes && (orgType === 'school' || orgType === 'ngo' || orgType === 'btp') && (
          <Link href={orgType === 'btp' ? '/btp/assignations' : '/utilisateurs/assignations'}>
            <Button variant="outline" size="sm">
              {orgType === 'school' ? (
                <GraduationCap className="h-4 w-4" />
              ) : orgType === 'ngo' ? (
                <FolderKanban className="h-4 w-4" />
              ) : (
                <HardHat className="h-4 w-4" />
              )}
              {orgType === 'school'
                ? 'Assignations classes'
                : orgType === 'ngo'
                  ? 'Assignations projets'
                  : 'Assignations chantiers'}
            </Button>
          </Link>
        )}
      </div>

      {canIssueCodes && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Codes d&apos;accès
            </CardTitle>
            <CardDescription>
              Générez un code <span className="font-mono">KONA-XXXX-XXXX</span> à transmettre au collaborateur.
              Il le saisira sur la page <strong>/rejoindre</strong> après création de son compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive font-medium rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                {error}
              </p>
            )}
            {info && (
              <p className={`text-sm rounded-lg p-3 ${infoTone === 'success' ? 'text-emerald-700 bg-emerald-500/10' : 'text-amber-800 bg-amber-500/15 border border-amber-200'}`}>
                {info}
              </p>
            )}
            {generatedCode && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-200 p-4">
                <code className="text-lg font-mono font-bold tracking-widest flex-1">{generatedCode}</code>
                <Button size="sm" variant="outline" onClick={() => copyCode(generatedCode)}>
                  <Copy className="h-4 w-4" />
                  {copied === generatedCode ? 'Copié' : 'Copier'}
                </Button>
              </div>
            )}
            <form onSubmit={handleGenerate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Rôle attribué</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {inviteRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email du collaborateur</Label>
                <Input name="recipient_email" type="email" placeholder="collaborateur@org.gn" />
              </div>
              <div className="space-y-2">
                <Label>Libellé (optionnel)</Label>
                <Input name="label" placeholder="Équipe terrain" />
              </div>
              <div className="space-y-2">
                <Label>Utilisations max</Label>
                <Input name="max_uses" type="number" min="1" max="100" defaultValue="1" />
              </div>
              <div className="space-y-2">
                <Label>Validité (jours)</Label>
                <Input name="expires_days" type="number" min="1" max="365" defaultValue="30" />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
                <Button type="submit" disabled={generating} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
                  <KeyRound className="h-4 w-4" />
                  {generating ? 'Génération…' : `Générer${role ? ` (→ ${ROLE_LABELS[role]})` : ''}`}
                </Button>
              </div>
            </form>

            {accessCodes.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-sm font-medium">Codes actifs et récents</p>
                {accessCodes.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3 text-sm space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono font-semibold">{c.code}</code>
                      <Badge variant="outline">{ROLE_LABELS[c.role] ?? c.role}</Badge>
                      <span className="text-muted-foreground">
                        {c.uses_count}/{c.max_uses} utilisations
                      </span>
                      {c.expires_at && (
                        <span className="text-muted-foreground">
                          exp. {new Date(c.expires_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      {c.emailed_at && (
                        <span className="text-muted-foreground text-xs">
                          ✉ {c.recipient_email} — {new Date(c.emailed_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>
                        {c.is_active ? 'Actif' : 'Révoqué'}
                      </Badge>
                      {c.is_active && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => copyCode(c.code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRevoke(c.id)}>
                            <Ban className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                    {c.is_active && (
                      <div className="flex gap-2 pl-1">
                        <Input
                          type="email"
                          placeholder="Renvoyer par email"
                          className="h-8 text-xs max-w-xs"
                          value={resendEmail[c.id] ?? c.recipient_email ?? ''}
                          onChange={(e) => setResendEmail((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => handleResend(c.id)}>
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {resetTarget && (
        <MemberCredentialsResetPanel
          member={resetTarget}
          canReset={memberCanManage(resetTarget)}
          onClose={() => setResetTarget(null)}
          onSuccess={(message) => {
            setInfoTone('success');
            setInfo(message);
            setError(null);
            router.refresh();
          }}
        />
      )}

      <DataTable
        title="Membres de l'organisation"
        data={users as unknown as Record<string, unknown>[]}
        columns={[
          {
            key: 'name',
            label: 'Utilisateur',
            render: (item) => (
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(item.name as string).split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{item.name as string}</p>
                  <p className="text-xs text-muted-foreground">{item.email as string}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'role',
            label: 'Rôle',
            render: (item) => (
              <Badge variant="outline">{ROLE_LABELS[item.role as AppRole] ?? item.role}</Badge>
            ),
          },
          {
            key: 'status',
            label: 'Statut',
            render: (item) => <StatusBadge status={item.status as string} />,
          },
          { key: 'lastLogin', label: 'Dernière connexion' },
          {
            key: 'access',
            label: 'Accès',
            render: (item) => {
              const user = item as unknown as UserRow;
              if (!memberCanManage(user)) {
                return <span className="text-xs text-muted-foreground">—</span>;
              }
              const busy = togglingUserId === user.id;
              if (user.isActive) {
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-red-200 text-red-800 hover:bg-red-500/10"
                    disabled={busy}
                    onClick={() => handleToggleAccess(user, false)}
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    {busy ? '…' : 'Bloquer'}
                  </Button>
                );
              }
              return (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-emerald-200 text-emerald-800 hover:bg-emerald-500/10"
                  disabled={busy}
                  onClick={() => handleToggleAccess(user, true)}
                >
                  <UserCheck className="h-3 w-3 mr-1" />
                  {busy ? '…' : 'Réactiver'}
                </Button>
              );
            },
          },
          {
            key: 'actions',
            label: 'Secours',
            render: (item) => {
              const user = item as unknown as UserRow;
              if (!memberCanManage(user) || !user.isActive) {
                return <span className="text-xs text-muted-foreground">—</span>;
              }
              return (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-amber-200 text-amber-900 hover:bg-amber-500/10"
                  onClick={() => {
                    setResetTarget(user);
                    setError(null);
                  }}
                >
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  Compte
                </Button>
              );
            },
          },
        ]}
      />

      {!canIssueCodes && (
        <Card className="border-dashed border-amber-200/80 bg-amber-500/5">
          <CardContent className="p-6 space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-2 text-muted-foreground">
                {issueStatus?.reason === 'migration_missing' ? (
                  <>
                    <p className="font-medium text-foreground">
                      Codes d&apos;accès : configuration base de données manquante
                    </p>
                    <p>
                      La migration <strong>012</strong> (table et fonctions{' '}
                      <span className="font-mono text-xs">organization_access_codes</span>) n&apos;est pas
                      encore appliquée sur Supabase, alors que les assignations (014+) peuvent déjà fonctionner.
                    </p>
                    <p>
                      Dans le SQL Editor du projet, exécutez le fichier{' '}
                      <span className="font-mono text-xs">supabase/sql-editor/012-access-codes-ONLY.sql</span>,
                      puis rechargez cette page.
                    </p>
                    {issueStatus.detail && (
                      <p className="text-xs font-mono text-amber-900/80">{issueStatus.detail}</p>
                    )}
                  </>
                ) : issueStatus?.reason === 'platform_admin' ? (
                  <>
                    <p className="font-medium text-foreground">Compte administrateur plateforme</p>
                    <p>
                      Les codes d&apos;invitation sont émis par le <strong>directeur</strong> ou le{' '}
                      <strong>directeur adjoint</strong> de l&apos;établissement (ex.{' '}
                      <span className="font-mono text-xs">director@isc.gn</span>), pas par l&apos;admin KonaData.
                    </p>
                  </>
                ) : issueStatus?.reason === 'no_org' ? (
                  <p>
                    Votre compte n&apos;est pas rattaché à une organisation. Utilisez un code sur{' '}
                    <strong>/rejoindre</strong> ou connectez-vous avec un compte directeur.
                  </p>
                ) : (
                  <>
                    <p className="font-medium text-foreground">Génération réservée aux responsables</p>
                    <p>
                      Seuls le <strong>directeur</strong> (<span className="font-mono text-xs">org_admin</span>)
                      et le <strong>directeur adjoint</strong> peuvent générer des codes. Le directeur adjoint ne
                      peut inviter que via les rôles collaborateurs (enseignant, élève, etc.) — pas un second adjoint.
                    </p>
                    {issueStatus?.detail && (
                      <p className="text-xs font-medium text-amber-900/90 rounded-md bg-amber-500/10 p-2">
                        {issueStatus.detail}
                      </p>
                    )}
                    <p className="text-xs">
                      Établissement : menu latéral <strong>Outils → Utilisateurs</strong> ou{' '}
                      <span className="font-mono">/utilisateurs</span>
                      — connectez-vous avec <span className="font-mono">director@isc.gn</span>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supabase : exécutez <span className="font-mono">DIAG-access-codes.sql</span> puis, si le rôle
                      n&apos;est pas <span className="font-mono">org_admin</span>,{' '}
                      <span className="font-mono">FIX-director-profiles.sql</span>.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
