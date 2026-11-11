import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

// ============ 请求体 ============

export class DevRegisterBody {
  @ApiProperty({ example: 'dev@example.com', description: '邮箱（登录账号）' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @ApiProperty({ description: '密码（需满足强度要求）' })
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  password!: string;
}

export class DevLoginBody {
  @ApiProperty({ example: 'dev@example.com', description: '邮箱' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}

export class DevApplyBody {
  @ApiProperty({ description: '公司/团队名称（个人开发者填个人名）' })
  @IsString()
  @IsNotEmpty({ message: '公司/团队名称不能为空' })
  company!: string;

  @ApiProperty({ description: '联系方式（手机号 / 邮箱 / 微信等）' })
  @IsString()
  @IsNotEmpty({ message: '联系方式不能为空' })
  contact!: string;

  @ApiProperty({ description: '开发者类型：personal 个人 / enterprise 企业' })
  @IsIn(['personal', 'enterprise'], { message: 'developer_type 仅支持 personal / enterprise' })
  developer_type!: 'personal' | 'enterprise';
}

export class DevUpdateProfileBody {
  @ApiPropertyOptional({ description: '公司/团队名称' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ description: '联系方式' })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({ description: '开发者类型：personal / enterprise' })
  @IsOptional()
  @IsIn(['personal', 'enterprise'], { message: 'developer_type 仅支持 personal / enterprise' })
  developer_type?: 'personal' | 'enterprise';
}

export class DevRevealSecretBody {
  @ApiProperty({ description: '当前账号登录密码（二次验证身份）' })
  @IsString()
  @IsNotEmpty({ message: '请输入登录密码以验证身份' })
  password!: string;
}

export class DevReviewBody {
  @ApiProperty({ description: '审核动作：approve 通过 / reject 驳回' })
  @IsIn(['approve', 'reject'], { message: 'action 必须是 approve 或 reject' })
  action!: 'approve' | 'reject';

  @ApiPropertyOptional({ description: '驳回理由；reject 时必填' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DevStatusBody {
  @ApiProperty({ description: '账号状态：active 启用 / suspended 停用' })
  @IsIn(['active', 'suspended'], { message: 'status 必须是 active 或 suspended' })
  status!: 'active' | 'suspended';

  @ApiPropertyOptional({ description: '停用理由；suspended 时必填' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============ 响应 ============

/** 开发者信息（不含密码哈希） */
export class DeveloperItem {
  @ApiProperty({ example: 1, description: '开发者 ID' })
  id!: number;

  @ApiProperty({ example: 'dev@example.com', description: '邮箱（登录账号）' })
  email!: string;

  @ApiProperty({ description: '公司/团队名称' })
  company!: string;

  @ApiProperty({ description: '联系方式' })
  contact!: string;

  @ApiProperty({ description: '账号状态：active 启用 / suspended 停用（能否登录）' })
  status!: 'active' | 'suspended';

  @ApiProperty({
    description: '开发者资格：none 未申请 / pending 待审核 / approved 已通过 / rejected 已驳回',
  })
  developer_status!: 'none' | 'pending' | 'approved' | 'rejected';

  @ApiProperty({ description: '资格驳回理由' })
  developer_reject_reason!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: '提交资格申请时间' })
  developer_applied_at!: string | null;

  @ApiProperty({ nullable: true, description: '开发者类型：personal / enterprise / null' })
  developer_type!: 'personal' | 'enterprise' | null;

  @ApiProperty({ description: '账号驳回理由（与资格驳回独立）' })
  reject_reason!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: '最后登录时间' })
  last_login_at!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: '注册时间' })
  created_at!: string;
}

export class DevLoginRes {
  @ApiProperty({ description: 'access token（Bearer，前端内存持有）' })
  access_token!: string;

  @ApiProperty({ example: 900, description: 'access token 有效期（秒）' })
  expires_in!: number;

  @ApiProperty({ type: DeveloperItem, description: '开发者信息' })
  developer!: DeveloperItem;
}

export class DevMeRes {
  @ApiProperty({ type: DeveloperItem })
  data!: DeveloperItem;
}

export class DevApplyRes {
  @ApiProperty({ type: DeveloperItem })
  data!: DeveloperItem;

  @ApiProperty({ example: '资料已提交，等待管理员审核', description: '提示信息' })
  message!: string;
}

export class DeveloperListRes {
  @ApiProperty({ type: [DeveloperItem] })
  data!: DeveloperItem[];
}

export class DeveloperItemRes {
  @ApiProperty({ type: DeveloperItem })
  data!: DeveloperItem;
}
