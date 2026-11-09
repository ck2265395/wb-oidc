import { createRouter, createWebHistory } from 'vue-router';
import { getAccessToken, refreshSession } from '../api';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/console' },
    { path: '/login', component: () => import('../views/LoginView.vue') },
    {
      path: '/console',
      component: () => import('../views/ConsoleView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/interaction/:uid', component: () => import('../views/InteractionView.vue') },
    { path: '/callback', component: () => import('../views/CallbackView.vue') },
  ],
});

/**
 * 管理页守卫：access token 只在内存，刷新页面后先尝试用 httpOnly cookie 静默续期。
 */
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    if (getAccessToken()) return true;
    const ok = await refreshSession();
    if (ok) return true;
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.path === '/login' && getAccessToken()) return '/console';
  return true;
});

export default router;
