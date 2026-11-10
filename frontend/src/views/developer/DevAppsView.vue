<template>
  <div class="workspace">
    <!-- 页头 -->
    <div class="ws-head">
      <div>
        <div class="ws-eyebrow">CONSOLE</div>
        <h2 class="page-title">工作台</h2>
        <p class="page-desc">你好，{{ dev?.email || '' }} · 查看账号状态，管理你的接入应用。</p>
      </div>
      <el-button text type="primary" @click="refreshAll">刷新</el-button>
    </div>

    <!-- 模块一：用户资料与状态 -->
    <section class="panel" v-loading="loadingUser">
      <div class="panel-head">
        <div class="panel-title">
          <span class="panel-index">01</span>
          <div>
            <h3>用户资料与状态</h3>
            <p>账号信息、开发者资格与审核进度</p>
          </div>
        </div>
        <div class="panel-actions">
          <el-button :icon="EditPen" @click="$router.push('/profile/edit')">编辑开发者资料</el-button>
          <el-button link type="primary" @click="$router.push('/profile')">查看完整资料 →</el-button>
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
                账号{{ accountText }}
              </el-tag>
              <el-tag :type="qualificationTag" size="small" round effect="light">
                {{ qualificationText }}
              </el-tag>
            </div>
            <div class="identity-meta">用户 ID · {{ dev?.id ?? '—' }}</div>
          </div>
        </div>

        <div class="profile-facts">
          <div class="fact"><span>公司 / 团队</span><b>{{ dev?.company || '未填写' }}</b></div>
          <div class="fact"><span>联系方式</span><b>{{ dev?.contact || '未填写' }}</b></div>
          <div class="fact"><span>注册时间</span><b>{{ fmtTime(dev?.created_at) }}</b></div>
          <div class="fact"><span>最近登录</span><b>{{ dev?.last_login_at ? fmtTime(dev.last_login_at) : '—' }}</b></div>
        </div>
      </div>

      <!-- 资格状态提示：始终展示，让普通用户也清楚自己能做什么 -->
      <el-alert
        v-if="dev?.status === 'suspended'"
        class="status-alert"
        type="error"
        :closable="false"
        show-icon
        title="账号已停用"
      >
        账号已被管理员停用，无法创建应用。{{ dev?.reject_reason || '请联系平台管理员处理。' }}
      </el-alert>
      <el-alert
        v-else-if="dev?.developer_status === 'pending'"
        class="status-alert"
        type="warning"
        :closable="false"
        show-icon
        title="开发者资格审核中"
      >
        资料已于 {{ fmtTime(dev?.developer_applied_at) }} 提交（{{ dev?.company || '—' }} / {{ dev?.contact || '—' }}），管理员审核通过后即可创建应用。审核期间可先阅读接入文档。
      </el-alert>
      <el-alert
        v-else-if="dev?.developer_status === 'rejected'"
        class="status-alert"
        type="error"
        :closable="false"
        show-icon
        title="开发者资格申请未通过"
      >
        {{ dev?.developer_reject_reason || '资料不完整，请修改后重新提交' }} · 点击「新建应用」即可更新资料并重新提交。
      </el-alert>
      <el-alert
        v-else-if="dev?.developer_status === 'approved'"
        class="status-alert"
        type="success"
        :closable="false"
        show-icon
        title="已通过开发者资格审核"
      >
        你现在可以创建接入应用，提交后还需管理员审核应用本身才能发起 OIDC 登录。
      </el-alert>
      <el-alert
        v-else
        class="status-alert"
        type="info"
        :closable="false"
        show-icon
        title="当前为普通用户"
      >
        你可以查看资料、浏览文档与应用列表。点击「新建应用」时补充资料并提交审核，通过后即可创建应用。
      </el-alert>
    </section>

    <!-- 模块二：我的应用列表 -->
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">
          <span class="panel-index">02</span>
          <div>
            <h3>我的应用</h3>
            <p>共 {{ apps.length }} 个应用 · 审核状态与回调地址一目了然</p>
          </div>
        </div>
        <!-- 按钮对所有用户常显可点：资格检测发生在点击时 -->
        <el-button type="primary" round @click="handleNewApp">+ 新建应用</el-button>
      </div>

      <div class="card-toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜索应用名称或 client_id"
          clearable
          :prefix-icon="Search"
          style="width: 280px"
        />
        <el-radio-group v-model="categoryFilter" class="cat-filter">
          <el-radio-button value="">全类目</el-radio-button>
          <el-radio-button value="web_app">网站应用</el-radio-button>
          <el-radio-button value="mobile_app">移动应用</el-radio-button>
          <el-radio-button value="mini_program">小程序</el-radio-button>
        </el-radio-group>
        <el-button text type="primary" @click="loadApps">刷新列表</el-button>
      </div>

      <el-table :data="filteredApps" v-loading="loading" class="apps-table">
        <el-table-column prop="client_name" label="应用" min-width="180">
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
        <el-table-column label="类目" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" round>{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="回调地址" min-width="220">
          <template #default="{ row }">
            <div v-for="u in row.redirect_uris" :key="u" class="uri-line">{{ u }}</div>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="110">
          <template #default="{ row }">
            <el-tooltip :content="row.reject_reason" :disabled="!row.reject_reason" placement="top">
              <el-tag :type="statusTag(row.status)" size="small" round effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              link
              type="primary"
              :disabled="row.status === 'pending'"
              @click="$router.push(`/apps/${row.client_id}/edit`)"
            >
              编辑
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有应用，点击右上角「新建应用」开始" />
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
import { CATEGORY_LABELS } from '../../api';
import devApi, {
  DevAppRow,
  DeveloperInfo,
  devFetchMe,
  extractDevError,
  getCurrentDeveloper,
} from '../../api/dev';

const router = useRouter();
const loading = ref(false);
const loadingUser = ref(true);
const apps = ref<DevAppRow[]>([]);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());
const keyword = ref('');
const categoryFilter = ref('');

function categoryLabel(cat?: string): string {
  return (cat && CATEGORY_LABELS[cat]) || '网站应用';
}

const avatarText = computed(() => (dev.value?.email || '?').slice(0, 1).toUpperCase());
const accountText = computed(() => (dev.value?.status === 'suspended' ? '已停用' : '正常'));
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
      none: '普通用户',
      pending: '资格审核中',
      approved: '已认证开发者',
      rejected: '申请未通过',
    }[dev.value?.developer_status || 'none'] || '普通用户'),
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
    ElMessage.error(extractDevError(e, '应用列表加载失败'));
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
      d.reject_reason || '账号已被管理员停用，无法创建应用，请联系平台管理员处理。',
      '账号已停用',
      { type: 'error', confirmButtonText: '知道了' },
    );
    return;
  }
  if (d.developer_status === 'pending') {
    ElMessageBox.alert(
      `你于 ${fmtTime(d.developer_applied_at)} 提交的资料（${d.company || '—'} / ${d.contact || '—'}）正在审核中，通过后即可创建应用。`,
      '开发者资格审核中',
      { type: 'warning', confirmButtonText: '知道了' },
    );
    return;
  }
  if (d.developer_status !== 'approved') {
    // 未认证：去资料编辑页补充并提交审核
    router.push('/profile/edit');
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
    { approved: '已通过', pending: '待审核', rejected: '已拒绝', suspended: '已停用' }[status] ||
    status
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
