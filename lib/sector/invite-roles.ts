import type { OrganizationType, AppRole } from '@/types/database';

export const INVITE_ROLES_BY_ORG: Record<OrganizationType, { value: AppRole; label: string }[]> = {
  school: [
    { value: 'teacher', label: 'Enseignant' },
    { value: 'student', label: 'Élève / étudiant' },
    { value: 'candidate', label: 'Candidat' },
    { value: 'registrar', label: 'Responsable scolarité' },
    { value: 'accountant', label: 'Comptable' },
    { value: 'deputy_director', label: 'Directeur adjoint' },
  ],
  ngo: [
    { value: 'deputy_director', label: 'Directeur adjoint' },
    { value: 'ngo_staff', label: 'Staff ONG' },
  ],
  btp: [
    { value: 'deputy_director', label: 'Directeur adjoint' },
    { value: 'btp_staff', label: 'Staff BTP' },
  ],
  business: [
    { value: 'deputy_director', label: 'Directeur adjoint' },
    { value: 'accountant', label: 'Comptable' },
    { value: 'pme_staff', label: 'Staff PME' },
  ],
};
