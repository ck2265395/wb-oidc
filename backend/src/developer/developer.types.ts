import { OidcDeveloper } from '../db/entities';

/** 账号能否登录 */
export type DeveloperAccountStatus = 'active' | 'suspended';
/** 开发者资格：能否创建应用 */
export type DeveloperQualification = 'none' | 'pending' | 'approved' | 'rejected';

export interface DeveloperView {
  id: string;
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
  id: string;
  email: string;
  status: DeveloperAccountStatus;
  developer_status: DeveloperQualification;
  developer_type?: 'personal' | 'enterprise';
}

export function toDeveloperView(row: OidcDeveloper): DeveloperView {
  return {
    id: row.id,
    email: row.email,
    company: row.company,
    contact: row.contact,
    status: row.status,
    developer_status: row.developerStatus,
    developer_reject_reason: row.developerRejectReason,
    developer_applied_at: row.developerAppliedAt
      ? new Date(row.developerAppliedAt).toISOString()
      : null,
    developer_type: row.developerType,
    reject_reason: row.rejectReason,
    last_login_at: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null,
    created_at: new Date(row.createdAt).toISOString(),
  };
}
