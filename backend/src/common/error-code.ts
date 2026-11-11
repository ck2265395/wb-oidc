/**
 * 统一业务错误码规范：1MMXX（5 位）
 * - 0        成功
 * - 1MMXX    错误：1 固定开头；MM = 模块号（00-99）；XX = 模块内错误号（00-99）
 * - 每模块 x x00 留作该模块兜底错误码（未细分时使用）
 * - 新模块按 100 递增申请新的 MM 段，模块内不许跨界借用
 *
 * 模块分配：
 * - 100xx  通用 / 系统（跨模块复用）
 * - 101xx  认证与会话（管理员 / 开发者登录态）
 * - 102xx  开发者资格
 * - 103xx  应用管理
 * - 104xx  OIDC 相关 REST API（协议端点本身遵循 OIDC 规范错误格式，不使用本码表）
 * - 105xx-199xx 预留
 *
 * 文案国际化：message 为 {zhCN, enUS} 双语对象，按请求头 language 取（见 pickMessage）。
 */
export interface LocalizedMessage {
  zhCN: string;
  enUS: string;
}

export interface ErrorCodeDef {
  /** 业务码（1MMXX） */
  code: number;
  /** 对应的 HTTP 状态码 */
  httpStatus: number;
  /** 默认错误文案（双语，可被抛错时覆盖） */
  message: LocalizedMessage;
}

/** 支持的响应语言（与前端 vue-i18n 的 LOCALES 保持一致） */
export type ResponseLang = 'zh-CN' | 'en-US';

/** 语言枚举值，供文档标注 */
export const LANGUAGES: readonly ResponseLang[] = ['zh-CN', 'en-US'];

/**
 * 按请求语言取文案；language 头缺失 / 非法时回退 zh-CN。
 * 支持 en、en-US、en_US 等写法归一化。
 */
export function pickLang(header: string | undefined | null): ResponseLang {
  const raw = (header || '').trim().toLowerCase();
  if (raw.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function pickMessage(msg: LocalizedMessage, lang: ResponseLang): string {
  return lang === 'en-US' ? msg.enUS : msg.zhCN;
}

export const ERROR_CODE = {
  // ============ 0 成功 ============
  OK: { code: 0, httpStatus: 200, message: { zhCN: 'success', enUS: 'success' } },

  // ============ 100xx 通用 / 系统 ============
  /** 模块兜底 */
  SYSTEM_ERROR: { code: 10000, httpStatus: 500, message: { zhCN: '系统内部错误，请稍后重试', enUS: 'Internal server error, please try again later' } },
  PARAM_INVALID: { code: 10001, httpStatus: 400, message: { zhCN: '参数校验失败', enUS: 'Invalid parameters' } },
  NOT_FOUND: { code: 10002, httpStatus: 404, message: { zhCN: '资源不存在', enUS: 'Resource not found' } },
  FORBIDDEN: { code: 10003, httpStatus: 403, message: { zhCN: '无权限执行此操作', enUS: 'Permission denied' } },
  UNAUTHORIZED: { code: 10004, httpStatus: 401, message: { zhCN: '未登录或凭证已失效', enUS: 'Not logged in or credentials expired' } },
  TOO_MANY_REQUESTS: { code: 10005, httpStatus: 429, message: { zhCN: '请求过于频繁，请稍后再试', enUS: 'Too many requests, please try again later' } },
  CONFLICT: { code: 10006, httpStatus: 409, message: { zhCN: '资源冲突', enUS: 'Resource conflict' } },
  METHOD_NOT_ALLOWED: { code: 10007, httpStatus: 405, message: { zhCN: '请求方式不支持', enUS: 'HTTP method not allowed' } },

  // ============ 101xx 认证与会话 ============
  /** 模块兜底 */
  AUTH_ERROR: { code: 10100, httpStatus: 401, message: { zhCN: '认证失败', enUS: 'Authentication failed' } },
  AUTH_INVALID_CREDENTIALS: { code: 10101, httpStatus: 401, message: { zhCN: '账号或密码不正确', enUS: 'Incorrect email or password' } },
  AUTH_ACCOUNT_SUSPENDED: { code: 10102, httpStatus: 403, message: { zhCN: '账号已被停用', enUS: 'Account has been suspended' } },
  AUTH_REFRESH_TOKEN_INVALID: { code: 10103, httpStatus: 401, message: { zhCN: '刷新令牌无效或已过期，请重新登录', enUS: 'Refresh token is invalid or expired, please log in again' } },
  AUTH_REFRESH_TOKEN_MISSING: { code: 10104, httpStatus: 401, message: { zhCN: '缺少刷新令牌', enUS: 'Refresh token is missing' } },
  AUTH_SESSION_REVOKED: { code: 10105, httpStatus: 401, message: { zhCN: '登录已失效，请重新登录', enUS: 'Session expired, please log in again' } },
  AUTH_USER_NOT_FOUND: { code: 10106, httpStatus: 401, message: { zhCN: '用户不存在', enUS: 'User not found' } },
  AUTH_PASSWORD_INCORRECT: { code: 10107, httpStatus: 401, message: { zhCN: '密码不正确', enUS: 'Incorrect password' } },
  AUTH_WEAK_PASSWORD: { code: 10108, httpStatus: 400, message: { zhCN: '密码强度不符合要求', enUS: 'Password does not meet strength requirements' } },

  // ============ 102xx 开发者资格 ============
  /** 模块兜底 */
  DEVELOPER_ERROR: { code: 10200, httpStatus: 400, message: { zhCN: '开发者资格操作失败', enUS: 'Developer qualification operation failed' } },
  DEVELOPER_NOT_FOUND: { code: 10201, httpStatus: 404, message: { zhCN: '开发者不存在', enUS: 'Developer not found' } },
  DEVELOPER_ALREADY_APPLIED: { code: 10202, httpStatus: 409, message: { zhCN: '申请正在审核中，请耐心等待', enUS: 'Application is under review, please wait' } },
  DEVELOPER_ALREADY_APPROVED: { code: 10203, httpStatus: 409, message: { zhCN: '你已通过开发者审核，无需重复申请', enUS: 'You are already an approved developer' } },
  DEVELOPER_NOT_APPROVED: { code: 10204, httpStatus: 403, message: { zhCN: '请先申请成为开发者，审核通过后才能继续操作', enUS: 'Please apply to become a developer first' } },
  DEVELOPER_UNDER_REVIEW: { code: 10205, httpStatus: 409, message: { zhCN: '开发者资格正在审核中，审核通过后才能继续操作', enUS: 'Developer application is under review' } },
  DEVELOPER_REJECTED: { code: 10206, httpStatus: 403, message: { zhCN: '开发者资格申请未通过', enUS: 'Developer application was rejected' } },
  DEVELOPER_NO_PENDING: { code: 10207, httpStatus: 400, message: { zhCN: '该用户没有待审核的开发者资格申请', enUS: 'No pending developer application for this user' } },
  DEVELOPER_EMAIL_INVALID: { code: 10208, httpStatus: 400, message: { zhCN: '邮箱格式不正确', enUS: 'Invalid email format' } },
  DEVELOPER_EMAIL_EXISTS: { code: 10209, httpStatus: 409, message: { zhCN: '该邮箱已注册', enUS: 'This email is already registered' } },
  DEVELOPER_PROFILE_INVALID: { code: 10210, httpStatus: 400, message: { zhCN: '开发者资料不符合要求', enUS: 'Developer profile does not meet requirements' } },

  // ============ 103xx 应用管理 ============
  /** 模块兜底 */
  APP_ERROR: { code: 10300, httpStatus: 400, message: { zhCN: '应用操作失败', enUS: 'App operation failed' } },
  APP_NOT_FOUND: { code: 10301, httpStatus: 404, message: { zhCN: '应用不存在', enUS: 'App not found' } },
  APP_UNDER_REVIEW: { code: 10302, httpStatus: 409, message: { zhCN: '应用正在审核中，暂不能修改', enUS: 'App is under review and cannot be modified' } },
  APP_REDIRECT_URI_INVALID: { code: 10303, httpStatus: 400, message: { zhCN: '回调地址不合法', enUS: 'Invalid redirect URI' } },
  APP_SCOPE_INVALID: { code: 10304, httpStatus: 400, message: { zhCN: 'scope 不合法，必须包含 openid', enUS: 'Invalid scope, openid is required' } },
  APP_CATEGORY_INVALID: { code: 10305, httpStatus: 400, message: { zhCN: '应用类目不合法', enUS: 'Invalid app category' } },
  APP_NAME_REQUIRED: { code: 10306, httpStatus: 400, message: { zhCN: '应用名称必填', enUS: 'App name is required' } },
  APP_ICP_REQUIRED: { code: 10307, httpStatus: 400, message: { zhCN: '企业开发者必须填写 ICP 备案号', enUS: 'ICP filing number is required for enterprise developers' } },
} as const;

/** 业务错误码常量集（key 索引） */
export type ErrorCodeKey = keyof typeof ERROR_CODE;
export type ErrorCode = (typeof ERROR_CODE)[ErrorCodeKey];
