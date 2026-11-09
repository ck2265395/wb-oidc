export type AdminRole = 'super_admin' | 'operator';

export interface AdminPrincipal {
  id: number;
  username: string;
  displayName: string;
  role: AdminRole;
}

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  enabled: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** 对外返回的管理员信息（绝不带 password_hash） */
export interface AdminView {
  id: number;
  username: string;
  display_name: string;
  role: AdminRole;
  enabled: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

export function toAdminView(row: AdminRow): AdminView {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    enabled: row.enabled,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
  };
}
