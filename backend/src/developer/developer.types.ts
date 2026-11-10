/** 账号能否登录 */
export type DeveloperAccountStatus = 'active' | 'suspended';
/** 开发者资格：能否创建应用 */
export type DeveloperQualification = 'none' | 'pending' | 'approved' | 'rejected';

export interface DeveloperRow {
  id: number;
  email: string;
  password_hash: string;
  company: string;
  contact: string;
  status: DeveloperAccountStatus;
  developer_status: DeveloperQualification;
  developer_reject_reason: string;
  developer_applied_at: Date | null;
  developer_type: 'personal' | 'enterprise' | null;
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
  status: DeveloperAccountStatus;
  developer_status: DeveloperQualification;
  developer_reject_reason: string;
  developer_applied_at: string | null;
  developer_type: 'personal' | 'enterprise' | null;
  reject_reason: string;
  last_login_at: string | null;
  created_at: string;
}

export interface DeveloperPrincipal {
  id: number;
  email: string;
  status: DeveloperAccountStatus;
  developer_status: DeveloperQualification;
  developer_type?: 'personal' | 'enterprise';
}

export function toDeveloperView(row: DeveloperRow): DeveloperView {
  return {
    id: row.id,
    email: row.email,
    company: row.company,
    contact: row.contact,
    status: row.status,
    developer_status: row.developer_status,
    developer_reject_reason: row.developer_reject_reason,
    developer_applied_at: row.developer_applied_at
      ? new Date(row.developer_applied_at).toISOString()
      : null,
    developer_type: row.developer_type,
    reject_reason: row.reject_reason,
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString(),
  };
}
