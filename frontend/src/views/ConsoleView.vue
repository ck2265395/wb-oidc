<template>
  <div class="console-shell">
    <el-container class="layout">
      <el-aside width="236px" class="aside">
        <div class="brand">
          <img class="brand-logo" src="/moondrop.ico" alt="M" />
          <div class="brand-text">
            <div class="brand-name">Moondrop</div>
            <div class="brand-sub">{{ t('console.shell.brandSub') }}</div>
          </div>
        </div>

        <div class="menu-scroll">
          <el-menu :default-active="route.path" router class="menu">
            <el-menu-item-group :title="t('console.nav.groupWorkspace')">
              <el-menu-item index="/console/overview">
                <el-icon><Odometer /></el-icon><span>{{ t('console.nav.overview') }}</span>
              </el-menu-item>
            </el-menu-item-group>

            <el-menu-item-group :title="t('console.nav.groupReview')">
              <el-menu-item index="/console/developers">
                <el-icon><User /></el-icon><span>{{ t('console.nav.developers') }}</span>
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
                <el-icon><Grid /></el-icon><span>{{ t('console.nav.clients') }}</span>
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

            <el-menu-item-group :title="t('console.nav.groupSystem')">
              <el-menu-item index="/console/admins">
                <el-icon><UserFilled /></el-icon><span>{{ t('console.nav.admins') }}</span>
              </el-menu-item>
              <el-menu-item index="/console/legacy-users">
                <el-icon><Search /></el-icon><span>{{ t('console.nav.legacyUsers') }}</span>
              </el-menu-item>
              <el-menu-item index="/console/audit">
                <el-icon><Document /></el-icon><span>{{ t('console.nav.audit') }}</span>
              </el-menu-item>
              <el-menu-item index="/console/sessions">
                <el-icon><Key /></el-icon><span>{{ t('console.nav.sessions') }}</span>
              </el-menu-item>
            </el-menu-item-group>
          </el-menu>
        </div>

        <div class="aside-foot">
          <RouterLink to="/" class="back-portal">← {{ t('console.shell.backPortal') }}</RouterLink>
          <div class="version">Moondrop OIDC · v1.0</div>
        </div>
      </el-aside>

      <el-container>
        <el-header height="64px" class="header">
          <el-breadcrumb separator="/" class="crumb">
            <el-breadcrumb-item>{{ t('console.shell.breadcrumb') }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>

          <div class="header-right">
            <el-tooltip :content="t('console.shell.refreshPending')" placement="bottom">
              <el-button text circle :icon="Refresh" @click="loadPending" />
            </el-tooltip>
            <el-badge :value="pendingTotal" :hidden="!pendingTotal" :max="99">
              <el-button plain type="primary" @click="goPending">
                <el-icon style="margin-right: 6px"><Bell /></el-icon>{{ t('console.shell.pendingReview') }}
              </el-button>
            </el-badge>
            <el-dropdown trigger="click" @command="onCommand">
              <div class="admin-chip">
                <el-avatar :size="30" class="admin-avatar">{{ avatarText }}</el-avatar>
                <div class="admin-meta">
                  <div class="admin-name">
                    {{ admin?.display_name || admin?.username || t('console.shell.defaultAdminName') }}
                  </div>
                  <div class="admin-role">{{ roleText }}</div>
                </div>
                <el-icon class="chev"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="password">
                    <el-icon><EditPen /></el-icon>{{ t('console.shell.changePassword') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="portal">
                    <el-icon><HomeFilled /></el-icon>{{ t('console.shell.portalHome') }}
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>{{ t('console.nav.logout') }}
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
    <el-dialog v-model="pwdVisible" :title="t('console.shell.pwdTitle')" width="440px" @closed="resetPwdForm">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-position="top">
        <el-form-item :label="t('console.shell.pwdOld')" prop="oldPassword">
          <el-input
            v-model="pwdForm.oldPassword"
            type="password"
            show-password
            autocomplete="current-password"
            :placeholder="t('console.shell.pwdOldPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('console.shell.pwdNew')" prop="newPassword">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="t('console.common.passwordRule')"
          />
        </el-form-item>
        <el-form-item :label="t('console.shell.pwdConfirm')" prop="confirmPassword">
          <el-input
            v-model="pwdForm.confirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="t('console.shell.pwdConfirmPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <el-alert
        type="warning"
        :closable="false"
        :title="t('console.shell.pwdAlert')"
      />
      <template #footer>
        <el-button @click="pwdVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="primary" :loading="pwdSubmitting" @click="submitPassword">
          {{ t('console.shell.pwdSubmit') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const admin = ref<AdminInfo | null>(getCurrentAdmin());

const PAGE_TITLE_KEYS: Record<string, string> = {
  overview: 'console.nav.overview',
  developers: 'console.nav.developers',
  clients: 'console.nav.clients',
  admins: 'console.nav.admins',
  'legacy-users': 'console.nav.legacyUsers',
  audit: 'console.nav.audit',
  sessions: 'console.nav.sessions',
};
const currentTitle = computed(
  () => t(PAGE_TITLE_KEYS[route.path.split('/').pop() || ''] || 'console.shell.breadcrumb'),
);
const avatarText = computed(() =>
  (admin.value?.display_name || admin.value?.username || 'A').slice(0, 1).toUpperCase(),
);
const roleText = computed(() =>
  admin.value?.role === 'super_admin'
    ? t('console.shell.roleSuperAdmin')
    : t('console.shell.roleOperator'),
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
    ElMessage.success(t('console.shell.loggedOut'));
    router.replace('/login');
  }
}

// 修改密码
const pwdVisible = ref(false);
const pwdSubmitting = ref(false);
const pwdFormRef = ref<FormInstance>();
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: t('console.shell.pwdOldRequired'), trigger: 'blur' }],
  newPassword: [
    { required: true, message: t('console.shell.pwdNewRequired'), trigger: 'blur' },
    { min: 10, max: 128, message: t('console.shell.pwdLength'), trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: t('console.common.passwordAlphaNum'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('console.shell.pwdConfirmRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== pwdForm.value.newPassword) callback(new Error(t('console.shell.pwdMismatch')));
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
    ElMessage.success(t('console.shell.pwdChanged'));
    setTimeout(() => router.replace('/login'), 800);
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    ElMessage.error(Array.isArray(msg) ? msg[0] : msg || t('console.shell.pwdChangeFailed'));
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
  background: var(--aside-bg);
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  color: rgba(255, 255, 255, 0.55);
}
.menu-scroll {
  flex: 1;
  overflow-y: auto;
}
.menu {
  border-right: none;
  padding: 8px;
  background: transparent;
}
.console-shell :deep(.el-menu-item-group__title) {
  padding: 18px 14px 8px;
  font-size: 11px;
  letter-spacing: 1.4px;
  color: #8494ad;
}
.console-shell :deep(.menu .el-menu-item) {
  height: 42px;
  line-height: 42px;
  border-radius: 7px;
  margin-bottom: 3px;
  font-size: 13px;
  color: #c7d2e3;
}
.console-shell :deep(.menu .el-menu-item .el-icon) {
  font-size: 16px;
  margin-right: 4px;
}
.console-shell :deep(.menu .el-menu-item.is-active) {
  color: #fff !important;
  background: linear-gradient(90deg, var(--aside-active), transparent) !important;
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--el-color-primary-light-3);
}
.console-shell :deep(.menu .el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
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
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.back-portal {
  font-size: 12px;
  color: #b3c1da;
  text-decoration: none;
}
.back-portal:hover {
  color: #fff;
}
.version {
  margin-top: 8px;
  font-size: 11px;
  color: #7d8cab;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--paper);
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
  background: var(--brand-50);
}
.admin-avatar {
  background: linear-gradient(135deg, var(--el-color-primary), var(--brand-700));
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
