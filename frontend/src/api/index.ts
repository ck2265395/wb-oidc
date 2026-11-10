import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/** issuer：同源部署时为空字符串，全部走相对路径 */
export const ISSUER = (import.meta.env.VITE_ISSUER as string) || '';

export interface AdminInfo {
  id: number;
  username: string;
  display_name: string;
  role: 'super_admin' | 'operator';
  enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

/**
 * access token 只放内存（模块变量），不落 localStorage/sessionStorage：
 * 页面刷新后靠 httpOnly 的 refresh cookie 静默续期，XSS 拿不到长期凭据。
 */
let accessToken = '';
let currentAdmin: AdminInfo | null = null;

export function getAccessToken(): string {
  return accessToken;
}

export function getCurrentAdmin(): AdminInfo | null {
  return currentAdmin;
}

const api = axios.create({
  baseURL: '',
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.url?.startsWith('/api/')) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/** 这些接口自身就是认证入口，401 时不能再触发刷新（否则会递归） */
const NO_REFRESH_URLS = [
  '/api/admin/auth/login',
  '/api/admin/auth/refresh',
  '/api/admin/auth/logout',
];

function isAuthUrl(url?: string): boolean {
  return !!url && NO_REFRESH_URLS.some((p) => url.startsWith(p));
}

/** 单飞刷新：并发 401 只触发一次 refresh */
let refreshing: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = api
      .post<{ access_token: string; admin: AdminInfo }>('/api/admin/auth/refresh')
      .then(({ data }) => {
        accessToken = data.access_token;
        currentAdmin = data.admin;
        return true;
      })
      .catch(() => {
        accessToken = '';
        currentAdmin = null;
        return false;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    if (status === 401 && config && !config._retried && !isAuthUrl(config.url)) {
      config._retried = true;
      const ok = await refreshSession();
      if (ok) return api.request(config);
      // 刷新失败 → 回登录页，带上回跳地址
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${redirect}`;
      }
    }
    return Promise.reject(error);
  },
);

export async function login(username: string, password: string): Promise<AdminInfo> {
  const { data } = await api.post<{ access_token: string; admin: AdminInfo }>(
    '/api/admin/auth/login',
    { username, password },
  );
  accessToken = data.access_token;
  currentAdmin = data.admin;
  return data.admin;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/admin/auth/logout');
  } finally {
    accessToken = '';
    currentAdmin = null;
  }
}

export async function fetchMe(): Promise<AdminInfo | null> {
  try {
    const { data } = await api.get<{ data: AdminInfo }>('/api/admin/auth/me');
    currentAdmin = data.data;
    return data.data;
  } catch {
    return null;
  }
}

/**
 * 自助修改密码。成功后服务端会吊销全部会话，
 * 这里同步清掉内存里的 access token，强制回登录页。
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.post('/api/admin/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
  accessToken = '';
  currentAdmin = null;
}

export interface ClientRow {
  id: number;
  client_id: string;
  client_secret: string;
  client_name: string;
  application_type: string;
  token_endpoint_auth_method: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  enabled: boolean;
  developer_id: number | null;
  developer_email?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  reject_reason: string;
  category: 'web_app' | 'mobile_app' | 'mini_program';
  logo: string;
  description: string;
  website: string;
  icp_number: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

/** 应用类目标签映射 */
export const CATEGORY_LABELS: Record<string, string> = {
  web_app: '网站应用',
  mobile_app: '移动应用',
  mini_program: '小程序',
};

// ===== 应用管理扩展 =====

export async function updateClient(
  clientId: string,
  dto: {
    client_name?: string;
    redirect_uris?: string[];
    scope?: string;
    category?: 'web_app' | 'mobile_app' | 'mini_program';
    logo?: string;
    description?: string;
    website?: string;
    icp_number?: string;
    tags?: string[];
  },
): Promise<ClientRow> {
  const { data } = await api.patch<{ data: ClientRow }>(`/api/admin/clients/${clientId}`, dto);
  return data.data;
}

export async function rotateClientSecret(clientId: string): Promise<string> {
  const { data } = await api.post<{ client_secret: string }>(
    `/api/admin/clients/${clientId}/rotate-secret`,
  );
  return data.client_secret;
}

// ===== 管理员账号管理（仅超管） =====

export async function listAdmins(): Promise<AdminInfo[]> {
  const { data } = await api.get<{ data: AdminInfo[] }>('/api/admin/users');
  return data.data;
}

export async function createAdmin(dto: {
  username: string;
  password: string;
  display_name?: string;
  role?: 'super_admin' | 'operator';
}): Promise<AdminInfo> {
  const { data } = await api.post<{ data: AdminInfo }>('/api/admin/users', dto);
  return data.data;
}

export async function updateAdmin(
  id: number,
  dto: { display_name?: string; role?: 'super_admin' | 'operator'; enabled?: boolean },
): Promise<AdminInfo> {
  const { data } = await api.patch<{ data: AdminInfo }>(`/api/admin/users/${id}`, dto);
  return data.data;
}

export async function resetAdminPassword(id: number, password: string): Promise<void> {
  await api.post(`/api/admin/users/${id}/reset-password`, { password });
}

export interface InteractionDetails {
  uid: string;
  prompt: { name: string; reasons: string[] };
  params: Record<string, string>;
  client: { client_id: string; client_name: string };
  session: boolean;
}

// ===== PKCE 工具（用于内置测试客户端发起完整流程）=====
function base64url(bytes: Uint8Array): string {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(digest));
  return { verifier, challenge };
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export default api;
