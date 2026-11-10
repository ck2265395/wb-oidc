<template>
  <div class="console-shell">
    <el-container class="layout">
      <el-aside width="236px" class="aside">
        <div class="brand">
          <img class="brand-logo" src="/moondrop.ico" alt="M" />
          <div class="brand-text">
            <div class="brand-name">Moondrop</div>
            <div class="brand-sub">统一身份管理控制台</div>
          </div>
        </div>

        <div class="menu-scroll">
          <el-menu
            :default-active="route.path"
            router
            class="menu"
            background-color="#0b1a33"
            text-color="#9fb0c9"
            active-text-color="#ffffff"
          >
            <el-menu-item-group title="工作台">
              <el-menu-item index="/console/overview">
                <el-icon><Odometer /></el-icon><span>总览</span>
              </el-menu-item>
            </el-menu-item-group>

            <el-menu-item-group title="审核管理">
              <el-menu-item index="/console/developers">
                <el-icon><User /></el-icon><span>开发者审核</span>
                <el-tag
                  v-if="pendingDevelopers"
                  size="small"
                  type="danger"
                  effect="dark"
                  round
                  class="menu-count"
                >
                  {{ pendingDevelopers }}
                </el-tag>
              </el-menu-item>
              <el-menu-item index="/console/clients">
                <el-icon><Grid /></el-icon><span>应用管理</span>
                <el-tag
                  v-if="pendingClients"
                  size="small"
                  type="warning"
                  effect="dark"
                  round
                  class="menu-count"
                >
                  {{ pendingClients }}
                </el-tag>
              </el-menu-item>
            </el-menu-item-group>

            <el-menu-item-group title="系统与用户">
              <el-menu-item index="/console/admins">
                <el-icon><UserFilled /></el-icon><span>管理员</span>
              </el-menu-item>
              <el-menu-item index="/console/legacy-users">
                <el-icon><Search /></el-icon><span>老库用户</span>
              </el-menu-item>
              <el-menu-item index="/console/audit">
                <el-icon><Document /></el-icon><span>审计日志</span>
              </el-menu-item>
              <el-menu-item index="/console/sessions">
                <el-icon><Key /></el-icon><span>会话管理</span>
              </el-menu-item>
            </el-menu-item-group>
          </el-menu>
        </div>

        <div class="aside-foot">
          <RouterLink to="/" class="back-portal">← 返回开放平台</RouterLink>
          <div class="version">Moondrop OIDC · v1.0</div>
        </div>
      </el-aside>

      <el-container>
        <el-header height="64px" class="header">
          <el-breadcrumb separator="/" class="crumb">
            <el-breadcrumb-item>控制台</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>

          <div class="header-right">
            <el-tooltip content="刷新待办数量" placement="bottom">
              <el-button text circle :icon="Refresh" @click="loadPending" />
            </el-tooltip>
            <el-badge :value="pendingTotal" :hidden="!pendingTotal" :max="99">
              <el-button plain type="primary" @click="goPending">
                <el-icon style="margin-right: 6px"><Bell /></el-icon>待办审核
              </el-button>
            </el-badge>
            <el-dropdown trigger="click" @command="onCommand">
              <div class="admin-chip">
                <el-avatar :size="30" class="admin-avatar">{{ avatarText }}</el-avatar>
                <div class="admin-meta">
                  <div class="admin-name">
                    {{ admin?.display_name || admin?.username || '管理员' }}
                  </div>
                  <div class="admin-role">{{ roleText }}</div>
                </div>
                <el-icon class="chev"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="password">
                    <el-icon><EditPen /></el-icon>修改密码
                  </el-dropdown-item>
                  <el-dropdown-item command="portal">
                    <el-icon><HomeFilled /></el-icon>开放平台首页
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <el-main class="console-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>

    <!-- 修改管理员密码 -->
    <el-dialog v-model="pwdVisible" title="修改管理员密码" width="440px" @closed="resetPwdForm">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-position="top">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="pwdForm.oldPassword"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="当前登录密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 10 位，含字母和数字"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="pwdForm.confirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="再输入一次新密码"
          />
        </el-form-item>
      </el-form>
      <el-alert
        type="warning"
        :closable="false"
        title="修改成功后所有设备都会退出登录，需要用新密码重新登录。"
      />
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSubmitting" @click="submitPassword">
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  Odometer,
  Grid,
  User,
  UserFilled,
  Search,
  Document,
  Key,
  Bell,
  Refresh,
  ArrowDown,
  EditPen,
  HomeFilled,
  SwitchButton,
} from '@element-plus/icons-vue';
import api, {
  changePassword,
  fetchMe,
  getCurrentAdmin,
  logout,
  AdminInfo,
} from '../api';

const router = useRouter();
const route = useRoute();
const admin = ref<AdminInfo | null>(getCurrentAdmin());

const PAGE_TITLES: Record<string, string> = {
  overview: '总览',
  developers: '开发者审核',
  clients: '应用管理',
  admins: '管理员',
  'legacy-users': '老库用户',
  audit: '审计日志',
  sessions: '会话管理',
};
const currentTitle = computed(
  () => PAGE_TITLES[route.path.split('/').pop() || ''] || '控制台',
);
const avatarText = computed(() =>
  (admin.value?.display_name || admin.value?.username || 'A').slice(0, 1).toUpperCase(),
);
const roleText = computed(() =>
  admin.value?.role === 'super_admin' ? '超级管理员' : '运营管理员',
);

/** 待办角标：审核动作后子页面会派发 console:pending-changed 通知刷新 */
const pendingDevelopers = ref(0);
const pendingClients = ref(0);
const pendingTotal = computed(() => pendingDevelopers.value + pendingClients.value);

interface OverviewResponse {
  data: {
    clients: { pending: string };
    developers: { pending: string };
  };
}

async function loadPending() {
  try {
    const { data } = await api.get<OverviewResponse>('/api/admin/overview');
    pendingDevelopers.value = Number(data?.data?.developers?.pending || 0);
    pendingClients.value = Number(data?.data?.clients?.pending || 0);
  } catch {
    // 统计接口失败不影响控制台使用
  }
}

function goPending() {
  router.push(pendingDevelopers.value > 0 ? '/console/developers' : '/console/clients');
}

function onCommand(command: string) {
  if (command === 'password') openPassword();
  else if (command === 'logout') handleLogout();
  else if (command === 'portal') router.push('/');
}

onMounted(() => {
  fetchMe().then((fresh) => {
    admin.value = fresh || getCurrentAdmin();
  });
  loadPending();
  window.addEventListener('console:pending-changed', loadPending);
});
onUnmounted(() => window.removeEventListener('console:pending-changed', loadPending));

async function handleLogout() {
  try {
    await logout();
  } finally {
    ElMessage.success('已退出登录');
    router.replace('/login');
  }
}

// 修改密码
const pwdVisible = ref(false);
const pwdSubmitting = ref(false);
const pwdFormRef = ref<FormInstance>();
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 10, max: 128, message: '密码长度需 10-128 位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '需同时包含字母和数字', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== pwdForm.value.newPassword) callback(new Error('两次输入的密码不一致'));
        else callback();
      },
      trigger: 'blur',
    },
  ],
};

function openPassword() {
  resetPwdForm();
  pwdVisible.value = true;
}

function resetPwdForm() {
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  pwdFormRef.value?.clearValidate();
}

async function submitPassword() {
  if (!pwdFormRef.value) return;
  const valid = await pwdFormRef.value.validate().catch(() => false);
  if (!valid) return;
  pwdSubmitting.value = true;
  try {
    await changePassword(pwdForm.value.oldPassword, pwdForm.value.newPassword);
    pwdVisible.value = false;
    ElMessage.success('密码已修改，请用新密码重新登录');
    setTimeout(() => router.replace('/login'), 800);
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    ElMessage.error(Array.isArray(msg) ? msg[0] : msg || '修改失败，请稍后重试');
  } finally {
    pwdSubmitting.value = false;
  }
}
</script>

<style scoped>
.console-shell {
  height: 100%;
  background: var(--canvas);
}
.layout {
  height: 100vh;
}
.aside {
  background: #0b1a33;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.brand {
  height: 68px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #fff;
  padding: 3px;
  box-sizing: border-box;
  object-fit: contain;
}
.brand-name {
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.2px;
}
.brand-sub {
  margin-top: 2px;
  font-size: 11px;
  color: #7c8db0;
}
.menu-scroll {
  flex: 1;
  overflow-y: auto;
}
.menu {
  border-right: none;
  padding: 8px;
  background: #0b1a33;
}
.console-shell :deep(.el-menu-item-group__title) {
  padding: 18px 14px 8px;
  font-size: 11px;
  letter-spacing: 1.4px;
  color: #5f7295;
}
.console-shell :deep(.menu .el-menu-item) {
  height: 42px;
  line-height: 42px;
  border-radius: 7px;
  margin-bottom: 3px;
  font-size: 13px;
}
.console-shell :deep(.menu .el-menu-item .el-icon) {
  font-size: 16px;
  margin-right: 4px;
}
.console-shell :deep(.menu .el-menu-item.is-active) {
  color: #fff !important;
  background: linear-gradient(90deg, rgba(11, 87, 208, 0.42), rgba(11, 87, 208, 0.08)) !important;
  box-shadow: inset 3px 0 0 #4a85e2;
}
.menu-count {
  margin-left: auto;
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
}
.aside-foot {
  flex-shrink: 0;
  padding: 16px 20px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.back-portal {
  font-size: 12px;
  color: #93a7c9;
  text-decoration: none;
}
.back-portal:hover {
  color: #fff;
}
.version {
  margin-top: 8px;
  font-size: 11px;
  color: #526381;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid var(--line);
  padding: 0 26px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.admin-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 7px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.admin-chip:hover {
  background: #f2f7ff;
}
.admin-avatar {
  background: linear-gradient(135deg, #0b57d0, #0a3d91);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}
.admin-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-900);
  line-height: 1.2;
}
.admin-role {
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-500);
}
.chev {
  color: var(--ink-300);
  font-size: 12px;
}
</style>
