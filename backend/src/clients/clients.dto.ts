import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** 第三方应用（OIDC Client）响应结构 */
export class ClientItem {
  @ApiProperty({ example: 1, description: '数据库自增 ID' })
  id!: number;

  @ApiProperty({ example: 'app_1a2b3c4d5e6f7g8h', description: '客户端 ID' })
  client_id!: string;

  @ApiPropertyOptional({
    description:
      'client_secret 的 AES-256-GCM 密文（数据库存储形态）；开发者端列表接口不返回该字段，明文仅通过创建/轮换/查看接口获取',
    nullable: true,
  })
  client_secret?: string;

  @ApiProperty({ example: '水月雨商城', description: '应用名称，1-64 字符' })
  client_name!: string;

  @ApiProperty({ example: 'web', description: '应用类型：web（网站，走 secret）/ spa（走 PKCE）' })
  application_type!: string;

  @ApiProperty({
    example: 'client_secret_basic',
    description: 'token 端点认证方式：client_secret_basic / none（PKCE）',
  })
  token_endpoint_auth_method!: string;

  @ApiProperty({
    type: [String],
    example: ['https://example.com/callback'],
    description: '授权回调地址列表，至少一个，须以 http(s):// 开头',
  })
  redirect_uris!: string[];

  @ApiProperty({ type: [String], description: '登出回调地址列表' })
  post_logout_redirect_uris!: string[];

  @ApiProperty({
    type: [String],
    example: ['authorization_code', 'refresh_token'],
    description: '授权方式（当前固定为 authorization_code + refresh_token）',
  })
  grant_types!: string[];

  @ApiProperty({ type: [String], example: ['code'], description: '响应类型（当前固定为 code）' })
  response_types!: string[];

  @ApiProperty({
    example: 'openid profile email',
    description: 'scope，空格分隔，必须包含 openid',
  })
  scope!: string;

  @ApiProperty({ description: '是否启用（启停开关，与审核状态独立）' })
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true, description: '归属开发者 ID；管理端直接创建时为 null' })
  developer_id!: string | null;

  @ApiPropertyOptional({ nullable: true, description: '归属开发者邮箱' })
  developer_email?: string | null;

  @ApiProperty({
    example: 'approved',
    description: '审核状态：pending 待审核 / approved 已通过 / rejected 已驳回 / suspended 已停用',
  })
  status!: 'pending' | 'approved' | 'rejected' | 'suspended';

  @ApiProperty({ description: '驳回/停用理由，通过时为空字符串' })
  reject_reason!: string;

  @ApiProperty({
    example: 'web_app',
    description: '应用类目：web_app 网站应用 / mobile_app 移动应用 / mini_program 小程序',
  })
  category!: 'web_app' | 'mobile_app' | 'mini_program';

  @ApiProperty({ description: '应用图标（dataURL 或 URL，100×100）' })
  logo!: string;

  @ApiProperty({ description: '应用描述，最长 200 字符' })
  description!: string;

  @ApiProperty({ description: '官网地址，http(s):// 开头' })
  website!: string;

  @ApiProperty({ description: 'ICP 备案号（企业开发者必填）' })
  icp_number!: string;

  @ApiProperty({ type: [String], description: '应用标签，最多 20 个' })
  tags!: string[];

  @ApiProperty({ type: String, format: 'date-time', description: '创建时间' })
  created_at!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: '更新时间' })
  updated_at!: Date;
}

export class CreateClientBody {
  @ApiProperty({ example: '水月雨商城', description: '应用名称，必填，1-64 字符' })
  @IsString()
  @MinLength(1, { message: 'client_name 必填' })
  @MaxLength(64, { message: 'client_name 最长 64 字符' })
  client_name!: string;

  @ApiProperty({
    type: [String],
    example: ['https://example.com/callback'],
    description: '授权回调地址，必填，至少一个，须以 http(s):// 开头',
  })
  @IsArray()
  @ArrayMaxSize(20, { message: 'redirect_uris 最多 20 个' })
  @Matches(/^https?:\/\/.+/i, { each: true, message: '回调地址须以 http(s):// 开头' })
  redirect_uris!: string[];

  @ApiPropertyOptional({
    description: '应用类型：web（走 secret）/ spa（走 PKCE）；默认按 category 推导',
  })
  @IsOptional()
  @IsIn(['web', 'spa'], { message: 'application_type 仅支持 web / spa' })
  application_type?: 'web' | 'spa';

  @ApiPropertyOptional({
    example: 'web_app',
    description: '应用类目：web_app / mobile_app / mini_program，默认 web_app；决定安全形态',
  })
  @IsOptional()
  @IsIn(['web_app', 'mobile_app', 'mini_program'], { message: 'category 取值非法' })
  category?: 'web_app' | 'mobile_app' | 'mini_program';

  @ApiPropertyOptional({ description: '应用图标（dataURL 或 URL，100×100）' })
  logo?: string;

  @ApiPropertyOptional({ description: '应用描述，最长 200 字符' })
  description?: string;

  @ApiPropertyOptional({ description: '官网地址，http(s):// 开头' })
  website?: string;

  @ApiPropertyOptional({ description: 'ICP 备案号（企业开发者创建应用必填）' })
  icp_number?: string;

  @ApiPropertyOptional({ type: [String], description: '应用标签，最多 20 个' })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'openid profile email',
    description: 'scope，空格分隔，默认 openid profile email',
  })
  scope?: string;

  @ApiPropertyOptional({ type: [String], description: '登出回调地址列表' })
  post_logout_redirect_uris?: string[];
}

export class UpdateClientBody {
  @ApiPropertyOptional({ description: '应用名称，1-64 字符' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'client_name 不能为空' })
  @MaxLength(64, { message: 'client_name 最长 64 字符' })
  client_name?: string;

  @ApiPropertyOptional({
    type: [String],
    description: '授权回调地址列表（改动后应用回到 pending 重新审核）',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'redirect_uris 最多 20 个' })
  @Matches(/^https?:\/\/.+/i, { each: true, message: '回调地址须以 http(s):// 开头' })
  redirect_uris?: string[];

  @ApiPropertyOptional({ description: 'scope，空格分隔，必须包含 openid（改动后回到 pending）' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({
    description: '应用类目：改动会同步调整安全形态（web_app 补发 secret，PKCE 类目清空 secret）',
  })
  @IsOptional()
  @IsIn(['web_app', 'mobile_app', 'mini_program'], { message: 'category 取值非法' })
  category?: 'web_app' | 'mobile_app' | 'mini_program';

  @ApiPropertyOptional({ description: '应用图标' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: '应用描述，最长 200 字符' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'description 最长 200 字符' })
  description?: string;

  @ApiPropertyOptional({ description: '官网地址，http(s):// 开头' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/i, { message: '官网地址须以 http(s):// 开头' })
  website?: string;

  @ApiPropertyOptional({ description: 'ICP 备案号' })
  @IsOptional()
  @IsString()
  icp_number?: string;

  @ApiPropertyOptional({ type: [String], description: '应用标签，最多 20 个' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'tags 最多 20 个' })
  tags?: string[];
}

export class ClientReviewBody {
  @ApiProperty({ description: '审核动作：approve 通过 / reject 驳回 / suspend 停用' })
  @IsIn(['approve', 'reject', 'suspend'], { message: 'action 必须是 approve / reject / suspend' })
  action!: 'approve' | 'reject' | 'suspend';

  @ApiPropertyOptional({ description: '理由；reject / suspend 时必填' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ClientCreateRes {
  @ApiProperty({ type: ClientItem, description: '新创建的应用' })
  data!: ClientItem;

  @ApiProperty({ description: 'client_secret 明文（仅在创建/轮换时返回一次，请妥善保存）' })
  client_secret!: string;
}

export class ClientItemRes {
  @ApiProperty({ type: ClientItem })
  data!: ClientItem;
}

export class ClientListRes {
  @ApiProperty({ type: [ClientItem] })
  data!: ClientItem[];
}

export class ClientSecretRes {
  @ApiProperty({ type: Object, description: '包含 client_id 与 client_secret 字段' })
  data!: { client_id: string; client_secret: string | null };
}
