'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HEARD_FROM_OPTIONS } from '@/lib/org/org-registration-profile';
import { AiSubscriptionPlanPicker } from '@/components/auth/ai-subscription-plan-picker';
import type { OrganizationType } from '@/types/database';

const fieldClass =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface Props {
  orgType: OrganizationType;
  /** Masquer le champ téléphone si le compte est créé par OTP téléphone */
  hideDeclaredPhone?: boolean;
}

export function OrgRegistrationFields({ orgType, hideDeclaredPhone = false }: Props) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">Dossier pour KonaData (analyse avant activation)</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact_title">Votre fonction *</Label>
          <Input
            id="contact_title"
            name="contact_title"
            placeholder="Directeur, Gérant, Responsable…"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legal_name">Raison sociale (si différente)</Label>
          <Input id="legal_name" name="legal_name" placeholder="Nom légal complet" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="organization_summary">Présentation de l&apos;organisation *</Label>
        <textarea
          id="organization_summary"
          name="organization_summary"
          className={fieldClass}
          rows={4}
          required
          minLength={20}
          placeholder="Activité, taille, objectifs avec KonaData, contexte local…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Adresse / quartier</Label>
          <Input id="address" name="address" placeholder="Commune, rue, repère…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="declared_city">Ville *</Label>
          <Input id="declared_city" name="declared_city" placeholder="Conakry" required />
        </div>
        {!hideDeclaredPhone && (
          <div className="space-y-2">
            <Label htmlFor="declared_phone">Téléphone *</Label>
            <Input id="declared_phone" name="declared_phone" placeholder="+224 622…" required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="website">Site web</Label>
          <Input id="website" name="website" type="text" placeholder="https://… (optionnel)" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heard_from">Comment nous avez-vous connu ? *</Label>
          <select
            id="heard_from"
            name="heard_from"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Choisir
            </option>
            {HEARD_FROM_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expected_go_live">Mise en service souhaitée</Label>
          <Input id="expected_go_live" name="expected_go_live" placeholder="Sept. 2026" />
        </div>
      </div>

      {orgType === 'school' && (
        <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="declared_expected_students">Effectif estimé (élèves) *</Label>
            <Input
              id="declared_expected_students"
              name="declared_expected_students"
              type="number"
              min={1}
              required
              placeholder="ex. 120"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_levels_offered">Niveaux / cycles</Label>
            <Input
              id="school_levels_offered"
              name="school_levels_offered"
              placeholder="Maternelle, primaire, Lycée…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_estimated_classes">Nombre de classes estimé</Label>
            <Input
              id="school_estimated_classes"
              name="school_estimated_classes"
              type="number"
              min={0}
              placeholder="ex. 8"
            />
          </div>
          <div className="space-y-2 sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="school_has_student_database" name="school_has_student_database" value="true" />
            <Label htmlFor="school_has_student_database" className="font-normal cursor-pointer">
              Nous avons déjà une base élèves (Excel, autre logiciel…)
            </Label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="school_prior_system_name">Logiciel ou fichier actuel</Label>
            <Input
              id="school_prior_system_name"
              name="school_prior_system_name"
              placeholder="Excel, GEP, autre…"
            />
          </div>
        </div>
      )}

      {orgType === 'btp' && (
        <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
          <div className="space-y-2">
            <Label htmlFor="btp_active_sites">Chantiers actifs</Label>
            <Input id="btp_active_sites" name="btp_active_sites" type="number" min={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="btp_team_size">Personnel terrain</Label>
            <Input id="btp_team_size" name="btp_team_size" type="number" min={0} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="btp_main_activity">Activité principale</Label>
            <Input id="btp_main_activity" name="btp_main_activity" placeholder="BTP, génie civil…" />
          </div>
        </div>
      )}

      {orgType === 'ngo' && (
        <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
          <div className="space-y-2">
            <Label htmlFor="ngo_active_projects">Projets actifs</Label>
            <Input id="ngo_active_projects" name="ngo_active_projects" type="number" min={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ngo_beneficiaries">Bénéficiaires estimés</Label>
            <Input id="ngo_beneficiaries" name="ngo_beneficiaries" type="number" min={0} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ngo_focus_areas">Axes d&apos;intervention</Label>
            <Input id="ngo_focus_areas" name="ngo_focus_areas" placeholder="Santé, éducation…" />
          </div>
        </div>
      )}

      {orgType === 'business' && (
        <div className="grid gap-3 sm:grid-cols-2 border-t pt-3">
          <div className="space-y-2">
            <Label htmlFor="pme_sector">Secteur d&apos;activité</Label>
            <Input id="pme_sector" name="pme_sector" placeholder="Commerce, distribution…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pme_team_size">Effectif</Label>
            <Input id="pme_team_size" name="pme_team_size" type="number" min={0} />
          </div>
          <div className="space-y-2 sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="pme_uses_inventory" name="pme_uses_inventory" value="true" />
            <Label htmlFor="pme_uses_inventory" className="font-normal cursor-pointer">
              Gestion stocks / achats à digitaliser
            </Label>
          </div>
        </div>
      )}

      <AiSubscriptionPlanPicker allowTrial={orgType === 'school'} />

      <div className="space-y-2">
        <Label htmlFor="additional_notes">Informations complémentaires</Label>
        <textarea
          id="additional_notes"
          name="additional_notes"
          className={fieldClass}
          rows={2}
          placeholder="Délais, contraintes, besoins prioritaires…"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Après envoi : votre compte reste sur <strong>Paramètres → Facturation</strong> jusqu&apos;à
        validation du tarif par KonaData. Vous recevrez ensuite un lien de paiement avec le montant
        validé.
      </p>
    </div>
  );
}
