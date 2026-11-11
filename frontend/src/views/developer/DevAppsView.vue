<template>
  <div class="workspace">
    <!-- 页头 -->
    <div class="ws-head">
      <div>
        <div class="ws-eyebrow">{{ t('developer.apps.eyebrow') }}</div>
        <h2 class="page-title">{{ t('developer.nav.workspace') }}</h2>
        <p class="page-desc">{{ t('developer.apps.welcome', { email: dev?.email || '' }) }}</p>
      </div>
      <el-button text type="primary" @click="refreshAll">{{ t('developer.common.refresh') }}</el-button>
    </div>

    <!-- 模块一：用户资料与状态 -->
    <section class="panel" v-loading="loadingUser">
      <div class="panel-head">
        <div class="panel-title">
          <span class="panel-index">01</span>
          <div>
            <h3>{{ t('developer.apps.profilePanelTitle') }}</h3>
            <p>{{ t('developer.apps.profilePanelDesc') }}</p>
          </div>
        </div>
        <div class="panel-actions">
          <el-button :icon="EditPen" @click="$router.push('/profile/edit?redirect=/apps')">{{ t('developer.common.editProfile') }}</el-button>
          <el-button link type="primary" @click="$router.push('/profile')">{{ t('developer.apps.viewFullProfile') }}</el-button>
        </div>
      </div>

      <div class="profile-row">
        <div class="profile-identity">
          <el-avatar :size="56" class="profile-avatar">{{ avatarText }}</el-avatar>
          <div class="identity-text">
            <div class="profile-email">{{ dev?.email || '—' }}</div>
            <div class="tag-row">
              <el-tag
                :type="dev?.status === 'active' ? 'success' : 'danger'"
                size="small"
                round
                effect="light"
              >
                {{ t('developer.common.accountTag', { status: accountText }) }}
              </el-tag>
              <el-tag :type="qualificationTag" size="small" round effect="light">
                {{ qualificationText }}
              </el-tag>
            </div>
            <div class="identity-meta">{{ t('developer.apps.userId', { id: dev?.id ?? '—' }) }}</div>
          </div>
        </div>

        <div class="profile-facts">
          <div class="fact"><span>{{ t('developer.common.company') }}</span><b>{{ dev?.company || t('developer.common.notFilled') }}</b></div>
          <div class="fact"><span>{{ t('developer.common.contact') }}</span><b>{{ dev?.contact || t('developer.common.notFilled') }}</b></div>
          <div class="fact"><span>{{ t('developer.common.registeredAt') }}</span><b>{{ fmtTime(dev?.created_at) }}</b></div>
          <div class="fact"><span>{{ t('developer.common.lastLoginAt') }}</span><b>{{ dev?.last_login_at ? fmtTime(dev.last_login_at) : '—' }}</b></div>
        </div>
      </div>

      <!-- 资格状态提示：始终展示，让普通用户也清楚自己能做什么 -->
      <el-alert
        v-if="dev?.status === 'suspended'"
        class="status-alert"
        type="error"
        :closable="false"
        show-icon
        :title="t('developer.common.suspended')"
      >
        {{ t('developer.apps.suspendedDesc') }}{{ dev?.reject_reason || t('developer.apps.contactAdmin') }}
      </el-alert>
      <el-alert
        v-else-if="dev?.developer_status === 'pending'"
        class="status-alert"
        type="warning"
        :closable="false"
        show-icon
        :title="t('developer.apps.qualificationPendingTitle')"
      >
        {{ t('developer.apps.qualificationPendingDesc', { time: fmtTime(dev?.developer_applied_at), company: dev?.company || '—', contact: dev?.contact || '—' }) }}
      </el-alert>
      <el-alert
        v-else-if="dev?.developer_status === 'rejected'"
        class="status-alert"
        type="error"
        :closable="false"
        show-icon
        :title="t('developer.apps.qualificationRejectedTitle')"
      >
        {{ dev?.developer_reject_reason || t('developer.apps.incompleteProfile') }}{{ t('developer.apps.qualificationRejectedDesc') }}
      </el-alert>
      <el-alert
        v-else-if="dev?.developer_status === 'approved'"
        class="status-alert"
        type="success"
        :closable="false"
        show-icon
        :title="t('developer.apps.qualificationApprovedTitle')"
      >
        {{ t('developer.apps.qualificationApprovedDesc') }}
      </el-alert>
      <el-alert
        v-else
        class="status-alert"
        type="info"
        :closable="false"
        show-icon
        :title="t('developer.apps.normalUserTitle')"
      >
        {{ t('developer.apps.normalUserDesc') }}
      </el-alert>
    </section>

    <!-- 模块二：我的应用列表 -->
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">
          <span class="panel-index">02</span>
          <div>
            <h3>{{ t('developer.apps.myAppsTitle') }}</h3>
            <p>{{ t('developer.apps.appsSummary', { count: apps.length }) }}</p>
          </div>
        </div>
        <!-- 按钮对所有用户常显可点：资格检测发生在点击时 -->
        <el-button type="primary" round @click="handleNewApp">{{ t('developer.apps.newApp') }}</el-button>
      </div>

      <div class="card-toolbar">
        <el-input
          v-model="keyword"
          :placeholder="t('developer.apps.searchPlaceholder')"
          clearable
          :prefix-icon="Search"
          style="width: 280px"
        />
        <el-radio-group v-model="categoryFilter" class="cat-filter">
          <el-radio-button value="">{{ t('developer.apps.catAll') }}</el-radio-button>
          <el-radio-button value="web_app">{{ t('developer.apps.catWeb') }}</el-radio-button>
          <el-radio-button value="mobile_app">{{ t('developer.apps.catMobile') }}</el-radio-button>
          <el-radio-button value="mini_program">{{ t('developer.apps.catMini') }}</el-radio-button>
        </el-radio-group>
        <el-button text type="primary" @click="loadApps">{{ t('developer.apps.refreshList') }}</el-button>
      </div>

      <el-table :data="filteredApps" v-loading="loading" class="apps-table">
        <el-table-column prop="client_name" :label="t('developer.apps.colApp')" min-width="180">
          <template #default="{ row }">
            <div class="app-name">
              <div class="app-avatar">
                <img v-if="row.logo" :src="row.logo" class="app-avatar-img" alt="" />
                <span v-else>{{ (row.client_name || '?').slice(0, 1) }}</span>
              </div>
              <div>
                <div class="app-title">{{ row.client_name }}</div>
                <div class="app-cid">{{ row.client_id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('developer.apps.colCategory')" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" round>{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('developer.apps.colRedirectUris')" min-width="220">
          <template #default="{ row }">
            <div v-for="u in row.redirect_uris" :key="u" class="uri-line">{{ u }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="t('developer.apps.colStatus')" width="110">
          <template #default="{ row }">
            <el-tooltip :content="row.reject_reason" :disabled="!row.reject_reason" placement="top">
              <el-tag :type="statusTag(row.status)" size="small" round effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('developer.common.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              link
              type="primary"
              :disabled="row.status === 'pending'"
              @click="$router.push(`/apps/${row.client_id}/edit`)"
            >
              {{ t('developer.common.edit') }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('developer.apps.emptyApps')" />
        </template>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, EditPen } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import devApi, {
  DevAppRow,
  DeveloperInfo,
  devFetchMe,
  extractDevError,
  getCurrentDeveloper,
} from '../../api/dev';

const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const loadingUser = ref(true);
const apps = ref<DevAppRow[]>([]);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());
const keyword = ref('');
const categoryFilter = ref('');

const CATEGORY_TEXTS: Record<string, string> = {
  web_app: 'developer.apps.catWeb',
  mobile_app: 'developer.apps.catMobile',
  mini_program: 'developer.apps.catMini',
};

function categoryLabel(cat?: string): string {
  return t((cat && CATEGORY_TEXTS[cat]) || 'developer.apps.catWeb');
}

const avatarText = computed(() => (dev.value?.email || '?').slice(0, 1).toUpperCase());
const accountText = computed(() =>
  dev.value?.status === 'suspended'
    ? t('developer.common.statusSuspended')
    : t('developer.common.statusNormal'),
);
const qualificationTag = computed(
  () =>
    ({
      none: 'info',
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
    }[dev.value?.developer_status || 'none'] || 'info'),
);
const qualificationText = computed(
  () =>
    ({
      none: t('developer.common.qualNone'),
      pending: t('developer.common.qualPending'),
      approved: t('developer.common.qualApproved'),
      rejected: t('developer.common.qualRejected'),
    }[dev.value?.developer_status || 'none'] || t('developer.common.qualNone')),
);

const filteredApps = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return apps.value.filter((a) => {
    if (categoryFilter.value && a.category !== categoryFilter.value) return false;
    if (!kw) return true;
    return (
      a.client_name.toLowerCase().includes(kw) || a.client_id.toLowerCase().includes(kw)
    );
  });
});

onMounted(refreshAll);

async function refreshUser() {
  // 管理员审核结果不体现在旧 token 里，实时拉一次最新状态
  const fresh = await devFetchMe();
  if (fresh) dev.value = fresh;
  loadingUser.value = false;
}

async function refreshAll() {
  loadingUser.value = true;
  await Promise.all([refreshUser(), loadApps()]);
}

async function loadApps() {
  loading.value = true;
  try {
    // 列表接口不校验开发者资格，普通用户也能看到自己的（空）应用列表
    const { data } = await devApi.get<{ data: DevAppRow[] }>('/api/developer/apps');
    apps.value = data.data;
  } catch (e) {
    apps.value = [];
    ElMessage.error(extractDevError(e, t('developer.apps.loadFailed')));
  } finally {
    loading.value = false;
  }
}

/**
 * 点「新建应用」时才检测开发者资格：
 * 已认证 → 跳转新建应用页；未认证 → 引导到资料编辑页补充资料并提交审核。
 */
async function handleNewApp() {
  await refreshUser();
  const d = dev.value;
  if (!d) return;
  if (d.status === 'suspended') {
    ElMessageBox.alert(
      d.reject_reason || t('developer.apps.suspendedMsg'),
      t('developer.common.suspended'),
      { type: 'error', confirmButtonText: t('developer.common.gotIt') },
    );
    return;
  }
  if (d.developer_status === 'pending') {
    ElMessageBox.alert(
      t('developer.apps.qualificationPendingMsg', {
        time: fmtTime(d.developer_applied_at),
        company: d.company || '—',
        contact: d.contact || '—',
      }),
      t('developer.apps.qualificationPendingTitle'),
      { type: 'warning', confirmButtonText: t('developer.common.gotIt') },
    );
    return;
  }
  if (d.developer_status !== 'approved') {
    // 未认证：去资料编辑页补充并提交审核，完成后回工作台
    router.push('/profile/edit?redirect=/apps');
    return;
  }
  router.push('/apps/new');
}

function fmtTime(s?: string | null): string {
  return s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '—';
}

function statusTag(status: string) {
  return status === 'approved' ? 'success' : status === 'pending' ? 'warning' : 'danger';
}

function statusText(status: string) {
  return (
    {
      approved: t('developer.apps.statusApproved'),
      pending: t('developer.apps.statusPending'),
      rejected: t('developer.apps.statusRejected'),
      suspended: t('developer.apps.statusSuspended'),
    }[status] || status
  );
}
</script>

<style scoped>
.workspace {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}
.ws-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}
.ws-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #0b57d0;
  margin-bottom: 8px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 800;
  color: #0b1220;
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

/* ---------- 模块卡片 ---------- */
.panel {
  background: #fff;
  border: 1px solid #e3eaf3;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.04);
  margin-bottom: 20px;
  border-top: 3px solid #0b57d0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eef2f7;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 14px;
}
.panel-index {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #ecf3fd;
  color: #0a3d91;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel-title h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: #0b1220;
}
.panel-title p {
  margin: 0;
  font-size: 12px;
  color: #8a97a8;
}

/* ---------- 模块一：资料与状态 ---------- */
.profile-row {
  display: flex;
  gap: 28px;
  align-items: stretch;
  flex-wrap: wrap;
}
.profile-identity {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 280px;
  flex: 1;
}
.profile-avatar {
  background: linear-gradient(135deg, #0b57d0, #0a3d91);
  color: #fff;
  font-weight: 700;
  font-size: 22px;
  flex-shrink: 0;
}
.profile-email {
  font-size: 16px;
  font-weight: 700;
  color: #0b1220;
  margin-bottom: 8px;
  word-break: break-all;
}
.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.identity-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}
.profile-facts {
  flex: 1.2;
  min-width: 300px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px 20px;
  padding: 4px 0 4px 28px;
  border-left: 1px solid #eef2f7;
}
.fact {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.fact span {
  font-size: 12px;
  color: #8a97a8;
}
.fact b {
  font-size: 13px;
  font-weight: 600;
  color: #0b1220;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-alert {
  margin-top: 22px;
}
.status-alert :deep(.el-alert__description) {
  line-height: 1.7;
}

/* ---------- 模块二：应用列表 ---------- */
.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.cat-filter {
  margin-right: auto;
}
.app-name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-avatar {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: linear-gradient(135deg, #0b57d0, #0a3d91);
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.app-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.app-title {
  font-weight: 600;
  color: #0b1220;
  font-size: 14px;
}
.app-cid {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
}
.uri-line {
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
}

@media (max-width: 768px) {
  .profile-facts {
    padding-left: 0;
    border-left: none;
    border-top: 1px solid #eef2f7;
    padding-top: 16px;
  }
}
</style>
