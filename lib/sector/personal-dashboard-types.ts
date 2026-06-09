export interface PersonalDashboardLink {
  href: string;
  label: string;
  description: string;
}

export interface PersonalDashboardResourceRow {
  id: string;
  name: string;
  meta?: string;
  status?: string;
}

export interface PersonalDashboardPayload {
  userName: string;
  highlights: { label: string; value: string }[];
  links: PersonalDashboardLink[];
  resources?: PersonalDashboardResourceRow[];
  resourcesTitle?: string;
  emptyAssignmentMessage?: string;
}
