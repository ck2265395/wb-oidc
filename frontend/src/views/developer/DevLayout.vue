<template>
  <div class="portal">
    <!-- 顶部导航 -->
    <header class="nav">
      <div class="nav-inner">
        <div class="brand" @click="$router.push('/')">
          <div class="brand-logo">WB</div>
          <div class="brand-text">
            <span class="brand-name">WB 开放平台</span>
            <span class="brand-sub">统一身份认证 · OIDC</span>
          </div>
        </div>

        <nav class="menu">
          <RouterLink to="/" class="menu-item" :class="{ active: route.path === '/' }">首页</RouterLink>
          <RouterLink to="/docs" class="menu-item" :class="{ active: route.path === '/docs' }">接入文档</RouterLink>
          <RouterLink
            to="/apps"
            class="menu-item"
            :class="{ active: route.path === '/apps' }"
          >
            我的应用
          </RouterLink>
        </nav>

        <div class="nav-right">
          <template v-if="!developer">
            <el-button text @click="$router.push('/developer/login?tab=login')">登录</el-button>
            <el-button type="primary" round @click="$router.push('/developer/login?tab=register')">
              注册开发者
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
                  <el-dropdown-item command="apps">📦 我的应用</el-dropdown-item>
                  <el-dropdown-item command="profile">👤 账号资料</el-dropdown-item>
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
        <span>© 2026 WB 开放平台 · 基于 OIDC 标准协议</span>
        <el-space :size="16">
          <RouterLink to="/docs" class="footer-link">接入文档</RouterLink>
          <RouterLink to="/" class="footer-link">开发者首页</RouterLink>
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
import { devLogout, getCurrentDeveloper, refreshDevSession, DeveloperInfo } from '../../api/dev';

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
  background: #f7f8fb;
}
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #eef0f4;
}
.nav-inner {
  max-width: 1120px;
  margin: 0 auto;
  height: 64px;
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
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}
.brand-sub {
  font-size: 11px;
  color: #9ca3af;
}
.menu {
  display: flex;
  gap: 8px;
  flex: 1;
}
.menu-item {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  color: #4b5563;
  text-decoration: none;
  transition: all 0.2s;
}
.menu-item:hover {
  color: #4f46e5;
  background: #eef2ff;
}
.menu-item.active {
  color: #4f46e5;
  font-weight: 600;
  background: #eef2ff;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
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
  background: #f3f4f6;
}
.user-avatar {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
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
  border-top: 1px solid #eef0f4;
  background: #fff;
}
.footer-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #9ca3af;
}
.footer-link {
  color: #6b7280;
  text-decoration: none;
}
.footer-link:hover {
  color: #4f46e5;
}
</style>
