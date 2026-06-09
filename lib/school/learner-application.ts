export interface PublicSchoolOption {
  id: string;
  name: string;
  email: string | null;
  city: string;
}

export interface SchoolCatalogClass {
  id: string;
  name: string;
  level: string | null;
  department: string | null;
  program: string | null;
  academic_year: string;
}

export interface SchoolApplicationCatalog {
  levels: string[];
  departments: string[];
  programs: string[];
  classes: SchoolCatalogClass[];
  hasClasses: boolean;
  error?: string;
}

export function formatSchoolClassLabel(c: SchoolCatalogClass): string {
  const parts = [c.name];
  if (c.level) parts.push(c.level);
  if (c.department) parts.push(c.department);
  if (c.program) parts.push(c.program);
  return parts.join(' — ');
}
