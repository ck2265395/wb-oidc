import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * 开发者门户专用 API 模块：
 * token 内存变量与管理端完全隔离（devAccessToken），refresh cookie 是独立的
 * `<adminCookie>_dev`，两个门户在同一浏览器登录互不干扰。
 */

export interface DeveloperInfo {
  id: number;
  email: string;
  company: string;
  contact: string;
  status: 'pending' | 'active' | 'suspended';
  reject_reason: string;
  last_login_at: string | null;
  created_at: string;
}

export interface DevAppRow {
  id: number;
  client_id: string;
  client_name: string;
  application_type: string;
  redirect_uris: string[];
  scope: string;
  enabled: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  reject_reason: string;
  created_at: string;
}

let devAccessToken = '';
let currentDeveloper: DeveloperInfo | null = null;

export function getDevAccessToken(): string {
  return devAccessToken;
}

export function getCurrentDeveloper(): DeveloperInfo | null {
  return currentDeveloper;
}

const devApi = axios.create({
  baseURL: '',
  timeout: 15000,
  withCredentials: true,
});

devApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (devAccessToken && config.url?.startsWith('/api/developer/')) {
    config.headers.Authorization = `Bearer ${devAccessToken}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const DEV_NO_REFRESH = ['/api/developer/auth/login', '/api/developer/auth/register', '/api/developer/auth/refresh', '/api/developer/auth/logout'];

let refreshing: Promise<boolean> | null = null;

export async function refreshDevSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = devApi
      .post<{ access_token: string; developer: DeveloperInfo }>('/api/developer/auth/refresh')
      .then(({ data }) => {
        devAccessToken = data.access_token;
        currentDeveloper = data.developer;
        return true;
      })
      .catch(() => {
        devAccessToken = '';
        currentDeveloper = null;
        return false;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

devApi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    if (
      status === 401 &&
      config &&
      !config._retried &&
      !DEV_NO_REFRESH.some((p) => config.url?.startsWith(p))
    ) {
      config._retried = true;
      const ok = await refreshDevSession();
      if (ok) return devApi.request(config);
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      if (!window.location.pathname.startsWith('/developer/login')) {
        window.location.href = `/developer/login?redirect=${redirect}`;
      }
    }
    return Promise.reject(error);
  },
);

export async function devLogin(email: string, password: string): Promise<DeveloperInfo> {
  const { data } = await devApi.post<{ access_token: string; developer: DeveloperInfo }>(
    '/api/developer/auth/login',
    { email, password },
  );
  devAccessToken = data.access_token;
  currentDeveloper = data.developer;
  return data.developer;
}

export async function devRegister(dto: {
  email: string;
  password: string;
  company?: string;
  contact?: string;
}): Promise<string> {
  const { data } = await devApi.post<{ message: string }>('/api/developer/auth/register', dto);
  return data.message;
}

export async function devLogout(): Promise<void> {
  try {
    await devApi.post('/api/developer/auth/logout');
  } finally {
    devAccessToken = '';
    currentDeveloper = null;
  }
}

export async function devFetchMe(): Promise<DeveloperInfo | null> {
  try {
    const { data } = await devApi.get<{ data: DeveloperInfo }>('/api/developer/auth/me');
    currentDeveloper = data.data;
    return data.data;
  } catch {
    return null;
  }
}

export function extractDevError(e: unknown, fallback: string): string {
  const msg = (e as any)?.response?.data?.message;
  return Array.isArray(msg) ? msg[0] : msg || fallback;
}

export default devApi;
