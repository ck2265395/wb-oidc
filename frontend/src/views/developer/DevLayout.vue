<template>
  <div class="portal">
    <!-- 顶部导航 -->
    <header class="nav">
      <div class="nav-inner">
        <div class="brand" @click="$router.push('/')">
          <img class="brand-logo" src="/moondrop.ico" alt="Moondrop" />
          <div class="brand-text">
            <span class="brand-name">Moondrop 开放平台</span>
            <span class="brand-sub">统一身份认证 · OIDC</span>
          </div>
        </div>

        <nav class="menu">
          <RouterLink to="/" class="menu-item" :class="{ active: route.path === '/' }">首页</RouterLink>
          <RouterLink to="/docs" class="menu-item" :class="{ active: route.path === '/docs' }">接入文档</RouterLink>
          <RouterLink
            to="/apps"
            class="menu-item"
            :class="{ active: route.path === '/apps' || route.path.startsWith('/apps/') }"
          >
            工作台
          </RouterLink>
        </nav>

        <div class="nav-right">
          <template v-if="!developer">
            <el-button text @click="$router.push('/developer/login?tab=login')">登录</el-button>
            <el-button type="primary" round @click="$router.push('/developer/login?tab=register')">
              免费注册
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
                  <el-dropdown-item command="apps">工作台</el-dropdown-item>
                  <el-dropdown-item command="profile">账号资料</el-dropdown-item>
                  <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
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
          <span>© 2026 Moondrop 开放平台 · 基于 OIDC 标准协议</span>
        </div>
        <el-space :size="16">
          <RouterLink to="/docs" class="footer-link">接入文档</RouterLink>
          <RouterLink to="/" class="footer-link">首页</RouterLink>
        </el-space>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import {
  devLogout,
  getDevAccessToken,
  getCurrentDeveloper,
  refreshDevSession,
  DeveloperInfo,
} from '../../api/dev';

const route = useRoute();
const router = useRouter();
const developer = ref<DeveloperInfo | null>(getCurrentDeveloper());

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
      ElMessage.success('已退出登录');
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
  background: #f6f9fd;
}
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e3eaf3;
}
.nav-inner {
  max-width: 1120px;
  margin: 0 auto;
  height: 66px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 40px;
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
  background: #fff;
  border: 1px solid #e3eaf3;
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
  color: #0b1220;
  white-space: nowrap;
}
.brand-sub {
  font-size: 11px;
  color: #8a97a8;
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
  color: #4b5563;
  text-decoration: none;
  transition: all 0.2s;
}
.menu-item:hover {
  color: #0b57d0;
  background: #ecf3fd;
}
.menu-item.active {
  color: #0b57d0;
  font-weight: 600;
  background: #ecf3fd;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
  background: #f1f5f9;
}
.user-avatar {
  background: #0a3d91;
  color: #fff;
  font-weight: 600;
}
.user-email {
  font-size: 13px;
  color: #374151;
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
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #9db4d8;
  gap: 16px;
  flex-wrap: wrap;
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
.footer-link {
  color: #b9cceb;
  text-decoration: none;
}
.footer-link:hover {
  color: #fff;
}
</style>
