import { OidcAdmin } from '../db/entities';

export type AdminRole = 'super_admin' | 'operator';

export interface AdminPrincipal {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
}

/** 对外返回的管理员信息（绝不带 passwordHash） */
export interface AdminView {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  enabled: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

export function toAdminView(row: OidcAdmin): AdminView {
  return {
    id: row.id,
    username: row.username,
    display_name: row.displayName,
    role: row.role,
    enabled: row.enabled,
    last_login_at: row.lastLoginAt,
    created_at: row.createdAt,
  };
}
