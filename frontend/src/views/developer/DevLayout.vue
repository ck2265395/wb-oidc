<template>
  <div class="portal">
    <!-- 顶部导航 -->
    <header class="nav">
      <div class="nav-inner">
        <div class="brand" @click="$router.push('/')">
          <img class="brand-logo" src="/moondrop.ico" alt="Moondrop" />
          <div class="brand-text">
            <span class="brand-name">{{ t('developer.nav.brand') }}</span>
            <span class="brand-sub">{{ t('developer.nav.brandSub') }}</span>
          </div>
        </div>

        <nav class="menu">
          <RouterLink to="/" class="menu-item" :class="{ active: route.path === '/' }">{{ t('developer.nav.home') }}</RouterLink>
          <RouterLink to="/docs" class="menu-item" :class="{ active: route.path === '/docs' }">{{ t('developer.nav.docs') }}</RouterLink>
          <RouterLink
            to="/apps"
            class="menu-item"
            :class="{ active: route.path === '/apps' || route.path.startsWith('/apps/') }"
          >
            {{ t('developer.nav.workspace') }}
          </RouterLink>
        </nav>

        <div class="nav-right">
          <!-- 语言切换 -->
          <el-dropdown trigger="click" @command="onLocaleCommand">
            <button class="nav-icon-btn" :title="t('common.settings.language')">
              <el-icon :size="17"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg></el-icon>
              <span class="nav-icon-text">{{ locale === 'zh-CN' ? 'EN' : '中' }}</span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="l in LOCALES"
                  :key="l.value"
                  :command="l.value"
                  :class="{ 'locale-active': locale === l.value }"
                >
                  {{ l.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 明暗切换 -->
          <el-tooltip :content="darkToggleTip" placement="bottom">
            <button class="nav-icon-btn" @click="toggleDark">
              <el-icon :size="17"><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
            </button>
          </el-tooltip>

          <span class="nav-divider" />

          <template v-if="!developer">
            <el-button text @click="$router.push('/developer/login?tab=login')">{{ t('developer.nav.signIn') }}</el-button>
            <el-button type="primary" round @click="$router.push('/developer/login?tab=register')">
              {{ t('developer.nav.register') }}
            </el-button>
          </template>
          <template v-else>
            <el-dropdown trigger="click" @command="onCommand">
              <div class="user-chip">
                <el-avatar :size="28" class="user-avatar">{{ avatarText }}</el-avatar>
                <span class="user-email">{{ developer.email }}</span>
                <el-icon><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="apps">{{ t('developer.nav.workspace') }}</el-dropdown-item>
                  <el-dropdown-item command="profile">{{ t('developer.nav.accountProfile') }}</el-dropdown-item>
                  <el-dropdown-item divided command="logout">{{ t('developer.nav.logout') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </div>
      </div>
    </header>

    <!-- 页面主体 -->
    <main class="page">
      <router-view />
    </main>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <img class="footer-logo" src="/moondrop.ico" alt="Moondrop" />
          <span>{{ t('developer.nav.copyright') }}</span>
        </div>
        
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { ArrowDown, Sunny, Moon } from '@element-plus/icons-vue';
import { LOCALES, switchLocale } from '../../i18n';
import { useTheme } from '../../composables/useTheme';
import {
  devLogout,
  getDevAccessToken,
  getCurrentDeveloper,
  refreshDevSession,
  DeveloperInfo,
} from '../../api/dev';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { darkMode, isDark, setDarkMode } = useTheme();
const developer = ref<DeveloperInfo | null>(getCurrentDeveloper());

/** 明暗按钮 tooltip：显示点击后将切换到的模式 */
const darkToggleTip = computed(() =>
  isDark.value ? t('developer.nav.lightMode') : t('developer.nav.darkMode'),
);

/** 明暗三档循环切换：亮 → 暗 → 跟随系统 → 亮 */
function toggleDark() {
  const next = darkMode.value === 'light' ? 'dark' : darkMode.value === 'dark' ? 'auto' : 'light';
  setDarkMode(next);
}

function onLocaleCommand(lang: 'zh-CN' | 'en-US') {
  switchLocale(lang);
}

onMounted(refreshUser);
watch(() => route.path, refreshUser);

async function refreshUser() {
  // 公开页（首页/文档）绝不能因为 401 被弹去登录页：
  // 用静默 refresh 判断登录态（失败只返回 false，不触发拦截器重定向）
  const hasToken = !!getDevAccessToken();
  if (!hasToken) await refreshDevSession();
  developer.value = getCurrentDeveloper();
}

const avatarText = computed(() => (developer.value?.email || '?').slice(0, 1).toUpperCase());

async function onCommand(cmd: string) {
  if (cmd === 'apps') router.push('/apps');
  else if (cmd === 'profile') router.push('/profile');
  else if (cmd === 'logout') {
    try {
      await devLogout();
    } finally {
      ElMessage.success(t('developer.nav.logoutSuccess'));
      router.replace('/');
    }
  }
}
</script>

<style scoped>
.portal {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--canvas);
}
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--nav-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.nav-inner {
  /* 铺满视口：导航品牌贴最左，工具区贴最右 */
  width: 100%;
  height: 66px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 40px;
  box-sizing: border-box;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--paper);
  border: 1px solid var(--line);
  object-fit: contain;
  padding: 2px;
  box-sizing: border-box;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
  white-space: nowrap;
}
.brand-sub {
  font-size: 11px;
  color: var(--ink-300);
}
.menu {
  display: flex;
  gap: 8px;
  flex: 1;
}
.menu-item {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--ink-700);
  text-decoration: none;
  transition: all 0.2s;
}
.menu-item:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.menu-item.active {
  color: var(--el-color-primary);
  font-weight: 600;
  background: var(--el-color-primary-light-9);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.nav-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 9px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ink-700);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.nav-icon-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.nav-icon-text {
  letter-spacing: 0.5px;
}
.nav-divider {
  width: 1px;
  height: 20px;
  background: var(--line);
  margin: 0 8px;
}
.locale-active {
  color: var(--el-color-primary);
  font-weight: 600;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 999px;
  transition: background 0.2s;
}
.user-chip:hover {
  background: var(--canvas);
}
.user-avatar {
  background: var(--brand-700);
  color: #fff;
  font-weight: 600;
}
.user-email {
  font-size: 13px;
  color: var(--ink-700);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page {
  flex: 1;
}
.footer {
  background: #061a3a;
  border-top: 1px solid #0a3d91;
}
.footer-inner {
  /* 铺满视口，与导航同宽 */
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #9db4d8;
  gap: 16px;
  flex-wrap: wrap;
  box-sizing: border-box;
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.footer-logo {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: #fff;
  padding: 2px;
  box-sizing: border-box;
  object-fit: contain;
}
</style>
