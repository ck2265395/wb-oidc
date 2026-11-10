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
        <el-button link type="primary" @click="$router.push('/profile')">查看完整资料 →</el-button>
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
        <el-button text type="primary" @click="loadApps">刷新列表</el-button>
      </div>

      <el-table :data="filteredApps" v-loading="loading" class="apps-table">
        <el-table-column prop="client_name" label="应用名称" min-width="150">
          <template #default="{ row }">
            <div class="app-name">
              <div class="app-avatar">{{ (row.client_name || '?').slice(0, 1) }}</div>
              <div>
                <div class="app-title">{{ row.client_name }}</div>
                <div class="app-cid">{{ row.client_id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="回调地址" min-width="220">
          <template #default="{ row }">
            <div v-for="u in row.redirect_uris" :key="u" class="uri-line">{{ u }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" round>
              {{ row.application_type === 'spa' ? '公共' : '机密' }}
            </el-tag>
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
              @click="openEdit(row)"
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

    <!-- 补充开发者信息（点新建应用且尚未通过资格审核时弹出） -->
    <el-dialog v-model="applyVisible" title="补充开发者信息" width="520px">
      <el-alert
        v-if="dev?.developer_status === 'rejected'"
        class="mb16"
        type="error"
        :closable="false"
        show-icon
        :title="dev?.developer_reject_reason || '上次申请未通过，请更新资料后重新提交'"
      />
      <p class="dialog-lead">
        创建应用需要开发者资格。请补充以下信息并提交，管理员审核通过后即可创建接入应用。
      </p>
      <el-form label-position="top">
        <el-form-item label="公司 / 团队" required>
          <el-input v-model="applyForm.company" placeholder="请填写公司或团队全称" maxlength="128" />
        </el-form-item>
        <el-form-item label="联系方式" required>
          <el-input v-model="applyForm.contact" placeholder="手机 / 邮箱 / 即时通讯账号" maxlength="64" />
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        title="提交后由管理员审核；审核期间可继续查看资料与接入文档。"
      />
      <template #footer>
        <el-button @click="applyVisible = false">取消</el-button>
        <el-button type="primary" :loading="applying" @click="submitApply">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 新建应用 -->
    <el-dialog v-model="createVisible" title="新建应用" width="520px">
      <el-form label-position="top">
        <el-form-item label="应用名称" required>
          <el-input v-model="createForm.client_name" placeholder="例如：小鹅砍价小程序" />
        </el-form-item>
        <el-form-item label="回调地址（每行一个）" required>
          <el-input
            v-model="createForm.redirect_uris_text"
            type="textarea"
            :rows="3"
            placeholder="https://app.example.com/auth/callback"
          />
        </el-form-item>
        <el-form-item label="应用类型">
          <el-radio-group v-model="createForm.application_type">
            <el-radio value="web">机密应用（有后端，client_secret 走后端）</el-radio>
            <el-radio value="spa">公共应用（SPA/小程序，强制 PKCE，无需 secret）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="申请的 scopes">
          <el-checkbox-group v-model="createForm.scopes">
            <el-checkbox value="profile">profile</el-checkbox>
            <el-checkbox value="email">email</el-checkbox>
            <el-checkbox value="phone">phone</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        title="提交后进入待审核状态，管理员审核通过后应用才能发起 OIDC 登录。"
      />
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- 编辑应用 -->
    <el-dialog v-model="editVisible" title="编辑应用" width="520px">
      <el-form label-position="top">
        <el-form-item label="应用名称" required>
          <el-input v-model="editForm.client_name" />
        </el-form-item>
        <el-form-item label="回调地址（每行一个）" required>
          <el-input v-model="editForm.redirect_uris_text" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="scopes（空格分隔，必须含 openid）">
          <el-input v-model="editForm.scope" placeholder="openid profile email" />
        </el-form-item>
      </el-form>
      <el-alert
        type="warning"
        :closable="false"
        title="修改回调地址或 scope 后，应用会回到待审核状态，需管理员重新审核。"
      />
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editing" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 凭据展示（仅显示一次） -->
    <el-dialog v-model="credentialVisible" title="凭据仅显示一次" width="560px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="client_id">
          <el-text copyable>{{ credential?.client_id }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item v-if="credential?.secret" label="client_secret">
          <el-text copyable type="danger">{{ credential.secret }}</el-text>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        class="mt16"
        type="warning"
        :closable="false"
        title="请立即保存到应用配置，此窗口关闭后无法再次查看。"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import devApi, {
  DevAppRow,
  DeveloperInfo,
  devApplyDeveloper,
  devFetchMe,
  extractDevError,
  getCurrentDeveloper,
} from '../../api/dev';

const loading = ref(false);
const loadingUser = ref(true);
const apps = ref<DevAppRow[]>([]);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());
const keyword = ref('');

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
  if (!kw) return apps.value;
  return apps.value.filter(
    (a) => a.client_name.toLowerCase().includes(kw) || a.client_id.toLowerCase().includes(kw),
  );
});

const applyVisible = ref(false);
const applying = ref(false);
const applyForm = ref({ company: '', contact: '' });
const createVisible = ref(false);
const creating = ref(false);
const editVisible = ref(false);
const editing = ref(false);
const credentialVisible = ref(false);
const credential = ref<{ client_id: string; secret: string } | null>(null);
const editingId = ref('');

const createForm = ref({
  client_name: '',
  redirect_uris_text: '',
  application_type: 'web',
  scopes: ['profile'],
});
const editForm = ref({ client_name: '', redirect_uris_text: '', scope: '' });

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
 * 已认证 → 直接打开创建弹窗；未认证 → 引导补充资料提交后台审核。
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
    openApply();
    return;
  }
  openCreate();
}

function openApply() {
  applyForm.value = { company: dev.value?.company || '', contact: dev.value?.contact || '' };
  applyVisible.value = true;
}

async function submitApply() {
  if (applyForm.value.company.trim().length < 2) {
    ElMessage.warning('请填写公司 / 团队名称');
    return;
  }
  if (applyForm.value.contact.trim().length < 2) {
    ElMessage.warning('请填写联系方式');
    return;
  }
  applying.value = true;
  try {
    dev.value = await devApplyDeveloper(applyForm.value.company.trim(), applyForm.value.contact.trim());
    applyVisible.value = false;
    ElMessage.success('资料已提交，等待管理员审核');
  } catch (e) {
    ElMessage.error(extractDevError(e, '提交失败，请稍后重试'));
  } finally {
    applying.value = false;
  }
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

function parseUris(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function openCreate() {
  createForm.value = { client_name: '', redirect_uris_text: '', application_type: 'web', scopes: ['profile'] };
  createVisible.value = true;
}

async function submitCreate() {
  if (!createForm.value.client_name) {
    ElMessage.warning('请填写应用名称');
    return;
  }
  const uris = parseUris(createForm.value.redirect_uris_text);
  if (!uris.length) {
    ElMessage.warning('请至少填写一个回调地址');
    return;
  }
  creating.value = true;
  try {
    const { data } = await devApi.post<{
      data: DevAppRow;
      client_id: string;
      client_secret: string;
    }>('/api/developer/apps', {
      client_name: createForm.value.client_name,
      redirect_uris: uris,
      application_type: createForm.value.application_type,
      scope: ['openid', ...createForm.value.scopes].join(' '),
    });
    createVisible.value = false;
    credential.value = { client_id: data.client_id, secret: data.client_secret };
    credentialVisible.value = true;
    await loadApps();
  } catch (e) {
    ElMessage.error(extractDevError(e, '提交失败'));
    // 资格可能在页面打开期间被撤销，刷新状态
    await refreshUser();
  } finally {
    creating.value = false;
  }
}

function openEdit(row: DevAppRow) {
  editingId.value = row.client_id;
  editForm.value = {
    client_name: row.client_name,
    redirect_uris_text: row.redirect_uris.join('\n'),
    scope: row.scope,
  };
  editVisible.value = true;
}

async function submitEdit() {
  editing.value = true;
  try {
    await devApi.patch(`/api/developer/apps/${editingId.value}`, {
      client_name: editForm.value.client_name,
      redirect_uris: parseUris(editForm.value.redirect_uris_text),
      scope: editForm.value.scope,
    });
    editVisible.value = false;
    ElMessage.success('已保存，应用回到待审核状态');
    await loadApps();
  } catch (e) {
    ElMessage.error(extractDevError(e, '保存失败'));
  } finally {
    editing.value = false;
  }
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

/* ---------- 弹窗 ---------- */
.dialog-lead {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.8;
  color: #4b5563;
}
.mb16 {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
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
