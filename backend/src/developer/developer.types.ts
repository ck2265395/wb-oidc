export interface DeveloperRow {
  id: number;
  email: string;
  password_hash: string;
  company: string;
  contact: string;
  status: 'pending' | 'active' | 'suspended';
  reject_reason: string;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeveloperView {
  id: number;
  email: string;
  company: string;
  contact: string;
  status: DeveloperRow['status'];
  reject_reason: string;
  last_login_at: string | null;
  created_at: string;
}

export interface DeveloperPrincipal {
  id: number;
  email: string;
  status: DeveloperRow['status'];
}

export function toDeveloperView(row: DeveloperRow): DeveloperView {
  return {
    id: row.id,
    email: row.email,
    company: row.company,
    contact: row.contact,
    status: row.status,
    reject_reason: row.reject_reason,
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString(),
  };
}
