import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// ============ 认证 /api/admin/auth ============

export class AdminLoginBody {
  @ApiProperty({ example: 'admin', description: '用户名' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}

export class AdminChangePasswordBody {
  @ApiProperty({ description: '原密码' })
  @IsString()
  @IsNotEmpty({ message: '原密码不能为空' })
  old_password!: string;

  @ApiProperty({ description: '新密码（需满足强度要求）' })
  @IsString()
  @MinLength(8, { message: '新密码至少 8 位' })
  @MaxLength(64, { message: '新密码最长 64 位' })
  new_password!: string;
}

/** 对外返回的管理员信息（绝不包含密码哈希） */
export class AdminUserItem {
  @ApiProperty({ example: 1, description: '管理员 ID' })
  id!: number;

  @ApiProperty({ example: 'admin', description: '用户名（登录账号）' })
  username!: string;

  @ApiProperty({ example: '超级管理员', description: '显示名称' })
  display_name!: string;

  @ApiProperty({ description: '角色：super_admin 超级管理员 / operator 运营' })
  role!: 'super_admin' | 'operator';

  @ApiProperty({ description: '是否启用' })
  enabled!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: '最后登录时间' })
  last_login_at!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: '创建时间' })
  created_at!: Date;
}

export class AdminLoginRes {
  @ApiProperty({ description: 'access token（Bearer，前端内存持有）' })
  access_token!: string;

  @ApiProperty({ example: 900, description: 'access token 有效期（秒）' })
  expires_in!: number;

  @ApiProperty({ type: AdminUserItem, description: '管理员信息' })
  admin!: AdminUserItem;
}

export class AdminUserItemRes {
  @ApiProperty({ type: AdminUserItem })
  data!: AdminUserItem;
}

export class AdminUserListRes {
  @ApiProperty({ type: [AdminUserItem] })
  data!: AdminUserItem[];
}

// ============ 管理员账号 /api/admin/users ============

export class CreateAdminBody {
  @ApiProperty({ example: 'operator01', description: '用户名，3-32 位字母/数字/_.-' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/, { message: '用户名需 3-32 位字母/数字/_.-' })
  username!: string;

  @ApiProperty({ description: '密码（需满足强度要求）' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;

  @ApiPropertyOptional({ description: '显示名称，默认同用户名，最长 64 字符' })
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'display_name 最长 64 字符' })
  display_name?: string;

  @ApiPropertyOptional({ description: '角色，默认 operator' })
  @IsOptional()
  @IsIn(['super_admin', 'operator'], { message: 'role 仅支持 super_admin / operator' })
  role?: 'super_admin' | 'operator';
}

export class UpdateAdminBody {
  @ApiPropertyOptional({ description: '显示名称，最长 64 字符' })
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'display_name 最长 64 字符' })
  display_name?: string;

  @ApiPropertyOptional({ description: '角色' })
  @IsOptional()
  @IsIn(['super_admin', 'operator'], { message: 'role 仅支持 super_admin / operator' })
  role?: 'super_admin' | 'operator';

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ResetPasswordBody {
  @ApiProperty({ description: '新密码（需满足强度要求）' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}

// ============ 运营 /api/admin/logs|sessions|overview ============

/** 审计日志条目 */
export class AdminLogItem {
  @ApiProperty({ description: '日志 ID（uuid）' })
  id!: string;

  @ApiProperty({ example: 'admin', description: "操作者类型：'admin' 管理端 / 'developer' 开发者门户" })
  actor_type!: 'admin' | 'developer';

  @ApiProperty({ nullable: true, description: '操作者管理员 ID（uuid，开发者操作时为 null）' })
  admin_id!: string | null;

  @ApiProperty({ example: 'admin', description: '操作者账号；开发者操作格式为 developer:<email>' })
  username!: string | null;

  @ApiProperty({
    example: 'client.create',
    description: '操作类型，如 client.create / admin.user.update / developer.review',
  })
  action!: string;

  @ApiProperty({ nullable: true, description: '操作对象（通常是 clientId / 用户名 / ID）' })
  target!: string | null;

  @ApiProperty({ nullable: true, description: '操作详情（JSON，结构随 action 不同）' })
  detail!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true, description: '操作来源 IP' })
  ip!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: '操作时间' })
  created_at!: Date;
}

export class AdminLogListRes {
  @ApiProperty({ type: [AdminLogItem] })
  data!: AdminLogItem[];

  @ApiProperty({ example: 100, description: '总条数' })
  total!: number;

  @ApiProperty({ example: 1, description: '当前页码' })
  page!: number;

  @ApiProperty({ example: 20, description: '每页条数（最大 100）' })
  size!: number;
}

/** OIDC 会话条目（provider Session） */
export class SessionItem {
  @ApiProperty({ description: '会话 ID（provider state 主键）' })
  id!: string;

  @ApiProperty({ nullable: true, description: '登录用户标识（老系统用户 uuid）' })
  account_id!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: '登录时间' })
  login_at!: string | null;

  @ApiProperty({ example: 2, description: '该会话已授权的应用数量' })
  authorized_clients!: number;

  @ApiProperty({ type: String, format: 'date-time', description: '会话过期时间' })
  expires_at!: Date;
}

export class SessionListRes {
  @ApiProperty({ type: [SessionItem] })
  data!: SessionItem[];

  @ApiProperty({ description: '总会话数' })
  total!: number;

  @ApiProperty({ description: '当前页码' })
  page!: number;

  @ApiProperty({ description: '每页条数' })
  size!: number;
}

export class OverviewCounts {
  @ApiProperty({ description: '总数' })
  total!: number;

  @ApiProperty({ description: '待审核数' })
  pending!: number;

  @ApiProperty({ description: '已通过数' })
  approved!: number;

  @ApiProperty({ description: '已驳回数' })
  rejected!: number;

  @ApiProperty({ description: '已停用数' })
  suspended!: number;
}

export class DeveloperOverviewCounts {
  @ApiProperty({ description: '开发者总数' })
  total!: number;

  @ApiProperty({ description: '资格待审核数' })
  pending!: number;

  @ApiProperty({ description: '资格已通过数' })
  active!: number;

  @ApiProperty({ description: '账号停用数' })
  suspended!: number;

  @ApiProperty({ description: '普通用户数（未申请开发者资格）' })
  normal!: number;
}

export class OverviewData {
  @ApiProperty({ type: OverviewCounts, description: '应用统计' })
  clients!: OverviewCounts;

  @ApiProperty({ type: DeveloperOverviewCounts, description: '开发者统计' })
  developers!: DeveloperOverviewCounts;

  @ApiProperty({ description: '活跃管理员会话数' })
  admin_sessions_active!: number;

  @ApiProperty({ description: 'OIDC 用户会话数' })
  provider_sessions!: number;

  @ApiProperty({ description: '老系统用户总数（字符串数字）' })
  legacy_users!: string;

  @ApiProperty({ type: [AdminLogItem], description: '最近 8 条审计日志' })
  recent_logs!: AdminLogItem[];
}

export class OverviewRes {
  @ApiProperty({ type: OverviewData })
  data!: OverviewData;
}

export class LegacyUserListRes {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      '老库用户行（动态表结构，含 uuid/username/nickname/email/phone/avatar 等），密码哈希与盐字段脱敏为 ******',
  })
  data!: Array<Record<string, unknown>>;

  @ApiProperty({ description: '总条数' })
  total!: number;

  @ApiProperty({ description: '当前页码' })
  page!: number;

  @ApiProperty({ description: '每页条数' })
  size!: number;
}
