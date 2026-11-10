import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BIGINT 读写转 number（id 在安全整数范围内，避免 pg 驱动把 int8 返回成字符串）。
 * 用于普通 BIGINT 列；自增主键列（PrimaryGeneratedColumn 不支持 transformer）
 * 在各 toXxxView / toClientRow 边界处手动 Number() 转换。
 */
export const bigintToNumber = {
  to: (v: number | null | undefined) => v,
  from: (v: unknown) => (v === null || v === undefined ? v : Number(v)),
};

export type ClientStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type ClientCategory = 'web_app' | 'mobile_app' | 'mini_program';
export type AdminRoleType = 'super_admin' | 'operator';
export type AccountStatus = 'active' | 'suspended';
export type DeveloperQualification = 'none' | 'pending' | 'approved' | 'rejected';

/** 第三方应用（OIDC Client）。client_secret 落库前已 AES-256-GCM 加密。 */
@Entity('oidc_clients')
export class OidcClient {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 64, unique: true })
  clientId: string;

  @Column({ name: 'client_secret', type: 'text' })
  clientSecret: string;

  @Column({ name: 'client_name', type: 'varchar', length: 128 })
  clientName: string;

  @Column({ name: 'application_type', type: 'varchar', length: 16, default: 'web' })
  applicationType: string;

  @Column({
    name: 'token_endpoint_auth_method',
    type: 'varchar',
    length: 32,
    default: 'client_secret_basic',
  })
  tokenEndpointAuthMethod: string;

  @Column({ name: 'redirect_uris', type: 'jsonb', default: () => "'[]'::jsonb" })
  redirectUris: string[];

  @Column({ name: 'post_logout_redirect_uris', type: 'jsonb', default: () => "'[]'::jsonb" })
  postLogoutRedirectUris: string[];

  @Column({
    name: 'grant_types',
    type: 'jsonb',
    default: () => `'["authorization_code","refresh_token"]'::jsonb`,
  })
  grantTypes: string[];

  @Column({ name: 'response_types', type: 'jsonb', default: () => `'["code"]'::jsonb` })
  responseTypes: string[];

  @Column({ type: 'text', default: 'openid profile email' })
  scope: string;

  @Column({ type: 'varchar', length: 24, default: 'web_app' })
  category: ClientCategory;

  @Column({ type: 'text', default: '' })
  logo: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'text', default: '' })
  website: string;

  @Column({ name: 'icp_number', type: 'text', default: '' })
  icpNumber: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({
    name: 'developer_id',
    type: 'bigint',
    nullable: true,
    transformer: bigintToNumber,
  })
  developerId: number | null;

  @Column({ type: 'varchar', length: 16, default: 'approved' })
  status: ClientStatus;

  @Column({ name: 'reject_reason', type: 'text', default: '' })
  rejectReason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** oidc-provider 协议运行时状态（Session/Code/Token/Grant...），data 为协议 payload */
@Entity('oidc_provider_state')
@Index('idx_state_uid', ['model', 'uid'])
@Index('idx_state_grant', ['grantId'])
@Index('idx_state_user_code', ['model', 'userCode'])
@Index('idx_state_expires', ['expiresAt'])
export class OidcProviderState {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  uid: string | null;

  @Column({ name: 'grant_id', type: 'varchar', length: 128, nullable: true })
  grantId: string | null;

  @Column({ name: 'user_code', type: 'varchar', length: 128, nullable: true })
  userCode: string | null;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
}

/** 管理端账号（独立于老系统，密码 bcrypt） */
@Entity('oidc_admin')
export class OidcAdmin {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'display_name', type: 'varchar', length: 64, default: '' })
  displayName: string;

  @Column({ type: 'varchar', length: 16, default: 'operator' })
  role: AdminRoleType;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** 管理端刷新令牌（只存 SHA-256 哈希，刷新即轮换、可单独吊销） */
@Entity('oidc_admin_session')
@Index('idx_admin_session_admin', ['adminId'])
@Index('idx_admin_session_expires', ['expiresAt'])
export class OidcAdminSession {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'admin_id', type: 'bigint', transformer: bigintToNumber })
  adminId: number;

  @ManyToOne(() => OidcAdmin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin: OidcAdmin;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** 管理端/开发者侧操作审计（共用一张表，开发者以 username 前缀 developer: 区分） */
@Entity('oidc_admin_log')
@Index('idx_admin_log_created', ['createdAt'])
export class OidcAdminLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({
    name: 'admin_id',
    type: 'bigint',
    nullable: true,
    transformer: bigintToNumber,
  })
  adminId: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  target: string | null;

  @Column({ type: 'jsonb', nullable: true })
  detail: Record<string, any> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** 门户账号：status 管登录资格，developer_status 管建应用资格（两字段解耦） */
@Entity('oidc_developer')
@Index('idx_developer_status', ['status'])
@Index('idx_developer_dev_status', ['developerStatus'])
export class OidcDeveloper {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  company: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  contact: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: AccountStatus;

  @Column({ name: 'developer_status', type: 'varchar', length: 16, default: 'none' })
  developerStatus: DeveloperQualification;

  @Column({ name: 'developer_reject_reason', type: 'text', default: '' })
  developerRejectReason: string;

  @Column({ name: 'developer_applied_at', type: 'timestamptz', nullable: true })
  developerAppliedAt: Date | null;

  @Column({ name: 'developer_type', type: 'varchar', length: 16, nullable: true })
  developerType: 'personal' | 'enterprise' | null;

  @Column({ name: 'reject_reason', type: 'text', default: '' })
  rejectReason: string;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** 开发者刷新令牌（与管理员会话同构） */
@Entity('oidc_developer_session')
@Index('idx_dev_session_developer', ['developerId'])
@Index('idx_dev_session_expires', ['expiresAt'])
export class OidcDeveloperSession {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'developer_id', type: 'bigint', transformer: bigintToNumber })
  developerId: number;

  @ManyToOne(() => OidcDeveloper, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: OidcDeveloper;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
