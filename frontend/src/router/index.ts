import { createRouter, createWebHistory } from 'vue-router';
import { getAccessToken, refreshSession } from '../api';
import { getDevAccessToken, refreshDevSession } from '../api/dev';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 开发者门户（根路径直达：首页/文档公开，应用管理/资料需登录）
    {
      path: '/',
      component: () => import('../views/developer/DevLayout.vue'),
      children: [
        { path: '', component: () => import('../views/developer/DevHomeView.vue') },
        { path: 'docs', component: () => import('../views/developer/DevDocsView.vue') },
        {
          path: 'apps',
          component: () => import('../views/developer/DevAppsView.vue'),
          meta: { requiresAuth: true, portal: 'developer' },
        },
        {
          path: 'profile',
          component: () => import('../views/developer/DevProfileView.vue'),
          meta: { requiresAuth: true, portal: 'developer' },
        },
      ],
    },
    { path: '/login', component: () => import('../views/LoginView.vue') },
    {
      path: '/console',
      component: () => import('../views/ConsoleView.vue'),
      meta: { requiresAuth: true, portal: 'admin' },
      redirect: '/console/overview',
      children: [
        {
          path: 'overview',
          component: () => import('../views/console/OverviewView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'clients',
          component: () => import('../views/console/ClientsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'developers',
          component: () => import('../views/console/DevelopersView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'admins',
          component: () => import('../views/console/AdminsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'audit',
          component: () => import('../views/console/AuditView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'sessions',
          component: () => import('../views/console/SessionsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'legacy-users',
          component: () => import('../views/console/LegacyUsersView.vue'),
          meta: { requiresAuth: true },
        },
      ],
    },
    {
      path: '/developer/login',
      component: () => import('../views/developer/DevLoginView.vue'),
    },
    // 兼容旧门户路径
    { path: '/developer/apps', redirect: '/apps' },
    { path: '/developer/docs', redirect: '/docs' },
    { path: '/developer', redirect: '/' },
    { path: '/interaction/:uid', component: () => import('../views/InteractionView.vue') },
    { path: '/callback', component: () => import('../views/CallbackView.vue') },
  ],
});

/**
 * 登录守卫：access token 只在内存，刷新页面后先尝试用 httpOnly cookie 静默续期。
 * 门户隔离：admin 用管理员 token，developer 用开发者 token，互不串。
 */
router.beforeEach(async (to) => {
  const portal = to.meta.portal || to.matched.find((r) => r.meta.portal)?.meta.portal;
  if (to.meta.requiresAuth) {
    if (portal === 'developer') {
      if (getDevAccessToken()) return true;
      const ok = await refreshDevSession();
      if (ok) return true;
      return { path: '/developer/login', query: { redirect: to.fullPath } };
    }
    if (getAccessToken()) return true;
    const ok = await refreshSession();
    if (ok) return true;
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.path === '/login' && getAccessToken()) return '/console';
  if (to.path === '/developer/login' && getDevAccessToken()) return '/apps';
  return true;
});

export default router;
