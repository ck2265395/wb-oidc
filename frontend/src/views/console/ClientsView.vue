<template>
  <ConsolePage
    eyebrow="APPLICATIONS"
    title="应用管理"
    desc="管理接入应用、回调白名单、密钥与审核状态。"
  >
    <template #actions>
      <el-button :icon="Refresh" @click="loadClients">刷新</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">注册新应用</el-button>
    </template>

    <el-row :gutter="16" class="stat-grid">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">接入应用</div>
              <div class="stat-value">{{ clients.length }}</div>
              <div class="stat-sub">平台全部应用</div>
            </div>
            <div class="stat-icon"><el-icon><Grid /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">待审核</div>
              <div class="stat-value">{{ pendingClients }}</div>
              <div class="stat-sub">等待处理</div>
            </div>
            <div class="stat-icon warn"><el-icon><Bell /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">已通过</div>
              <div class="stat-value">{{ approvedClients }}</div>
              <div class="stat-sub">审核已通过</div>
            </div>
            <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">启用中</div>
              <div class="stat-value">{{ enabledClients }}</div>
              <div class="stat-sub">可发起 OIDC 登录</div>
            </div>
            <div class="stat-icon"><el-icon><Key /></el-icon></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="box-card">
      <div class="cp-toolbar">
        <el-radio-group v-model="statusFilter">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="pending">待审核</el-radio-button>
          <el-radio-button value="approved">已通过</el-radio-button>
        </el-radio-group>
        <div class="spacer" />
        <el-tag v-if="pendingClients" type="warning" effect="light" round size="large">
          {{ pendingClients }} 个应用待审核
        </el-tag>
      </div>

    <el-table :data="filteredClients" v-loading="loading" stripe>
      <el-table-column label="应用名称" min-width="180">
        <template #default="{ row }">
          <div class="app-cell">
            <div class="app-avatar">{{ (row.client_name || '?').slice(0, 1) }}</div>
            <div>
              <div class="app-name">{{ row.client_name }}</div>
              <div class="app-cid mono">{{ row.client_id }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="developer_email" label="申请人" min-width="160">
        <template #default="{ row }">
          <span v-if="row.developer_email">{{ row.developer_email }}</span>
          <el-tag v-else size="small" type="info">平台创建</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag size="small">{{ row.application_type === 'spa' ? '公共' : '机密' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="回调地址" min-width="220">
        <template #default="{ row }">
          <div v-for="u in row.redirect_uris" :key="u" class="uri-line">{{ u }}</div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tooltip :content="row.reject_reason" :disabled="!row.reject_reason" placement="top">
            <el-tag :type="reviewTag(row)" size="small">{{ reviewText(row) }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="330" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="success" @click="doReview(row, 'approve')">通过</el-button>
            <el-button size="small" type="danger" @click="doReview(row, 'reject')">拒绝</el-button>
          </template>
          <el-button
            size="small"
            type="primary"
            link
            @click="startTestLogin(row)"
            :disabled="!sameOriginRedirect(row)"
          >
            测试登录
          </el-button>
          <el-button size="small" link @click="openEdit(row)">编辑</el-button>
          <el-button
            v-if="row.application_type !== 'spa'"
            size="small"
            type="warning"
            link
            @click="doRotate(row)"
          >
            轮换密钥
          </el-button>
          <el-button size="small" type="warning" link @click="toggle(row)">
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" link @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    </el-card>

    <!-- 创建应用 -->
    <el-dialog v-model="createVisible" title="注册新应用" width="520px">
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
            <el-checkbox value="openid">openid</el-checkbox>
            <el-checkbox value="profile">profile</el-checkbox>
            <el-checkbox value="email">email</el-checkbox>
            <el-checkbox value="phone">phone</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
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
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editing" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 凭据展示（创建/轮换共用，仅显示一次） -->
    <el-dialog v-model="credentialVisible" title="凭据仅显示一次" width="560px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="client_id">
          <el-text copyable>{{ credential?.client_id }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item label="client_secret（新）">
          <el-text copyable type="danger">{{ credential?.secret }}</el-text>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        class="mt16"
        type="warning"
        :closable="false"
        title="旧 secret 立即失效，请立即保存并更新到应用配置"
      />
    </el-dialog>

    <!-- 拒绝理由 -->
    <el-dialog v-model="rejectVisible" title="填写拒绝理由" width="440px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        placeholder="请填写拒绝理由（开发者门户可见）"
      />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejecting" @click="submitReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Plus, Grid, Bell, CircleCheck, Key,
} from '@element-plus/icons-vue';
import ConsolePage from '../../components/console/ConsolePage.vue';
import api, {
  ClientRow,
  createPkce,
  ISSUER,
  rotateClientSecret,
  updateClient,
} from '../../api';

const loading = ref(false);
const clients = ref<ClientRow[]>([]);
const statusFilter = ref('');
const rejectVisible = ref(false);
const rejectReason = ref('');
const rejecting = ref(false);
const rejectTarget = ref<ClientRow | null>(null);
const createVisible = ref(false);

const filteredClients = computed(() =>
  statusFilter.value ? clients.value.filter((c) => c.status === statusFilter.value) : clients.value,
);
const pendingClients = computed(
  () => clients.value.filter((c) => c.status === 'pending').length,
);
const approvedClients = computed(
  () => clients.value.filter((c) => c.status === 'approved').length,
);
const enabledClients = computed(
  () => clients.value.filter((c) => c.status === 'approved' && c.enabled).length,
);
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
  scopes: ['openid', 'profile'],
});
const editForm = ref({ client_name: '', redirect_uris_text: '', scope: '' });

onMounted(loadClients);

async function loadClients() {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: ClientRow[] }>('/api/admin/clients');
    clients.value = data.data;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  createForm.value = {
    client_name: '',
    redirect_uris_text: '',
    application_type: 'web',
    scopes: ['openid', 'profile'],
  };
  createVisible.value = true;
}

function parseUris(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function submitCreate() {
  creating.value = true;
  try {
    const { data } = await api.post<{ data: ClientRow; client_secret: string }>(
      '/api/admin/clients',
      {
        client_name: createForm.value.client_name,
        redirect_uris: parseUris(createForm.value.redirect_uris_text),
        application_type: createForm.value.application_type,
        scope: ['openid', ...createForm.value.scopes.filter((s) => s !== 'openid')].join(' '),
      },
    );
    createVisible.value = false;
    credential.value = { client_id: data.data.client_id, secret: data.client_secret };
    credentialVisible.value = true;
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, '创建失败'));
  } finally {
    creating.value = false;
  }
}

function openEdit(row: ClientRow) {
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
    await updateClient(editingId.value, {
      client_name: editForm.value.client_name,
      redirect_uris: parseUris(editForm.value.redirect_uris_text),
      scope: editForm.value.scope,
    });
    editVisible.value = false;
    ElMessage.success('已保存');
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, '保存失败'));
  } finally {
    editing.value = false;
  }
}

async function doRotate(row: ClientRow) {
  try {
    await ElMessageBox.confirm(
      `确认轮换「${row.client_name}」的 client_secret？旧密钥将立即失效。`,
      '轮换密钥',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    const secret = await rotateClientSecret(row.client_id);
    credential.value = { client_id: row.client_id, secret };
    credentialVisible.value = true;
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, '轮换失败'));
  }
}

async function toggle(row: ClientRow) {
  await api.patch(`/api/admin/clients/${row.client_id}/enabled/${!row.enabled}`);
  await loadClients();
}

async function remove(row: ClientRow) {
  try {
    await ElMessageBox.confirm(`确认删除应用「${row.client_name}」？该操作不可恢复`, '警告', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await api.delete(`/api/admin/clients/${row.client_id}`);
  await loadClients();
  ElMessage.success('已删除');
}

function reviewTag(row: ClientRow): string {
  if (row.status === 'pending') return 'warning';
  if (row.status === 'approved') return row.enabled ? 'success' : 'info';
  return 'danger';
}

function reviewText(row: ClientRow): string {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: row.enabled ? '启用' : '已停用',
    rejected: '已拒绝',
    suspended: '已停用',
  };
  return map[row.status] || row.status;
}

async function doReview(row: ClientRow, action: 'approve' | 'reject') {
  if (action === 'reject') {
    rejectReason.value = '';
    rejectTarget.value = row;
    rejectVisible.value = true;
    return;
  }
  try {
    await ElMessageBox.confirm(`确认通过应用「${row.client_name}」的审核？`, '审核确认', {
      type: 'success',
    });
  } catch {
    return;
  }
  await api.post(`/api/admin/clients/${row.client_id}/review`, { action: 'approve' });
  ElMessage.success('审核通过');
  window.dispatchEvent(new Event('console:pending-changed'));
  await loadClients();
}

async function submitReject() {
  if (!rejectTarget.value || !rejectReason.value.trim()) {
    ElMessage.warning('请填写拒绝理由');
    return;
  }
  rejecting.value = true;
  try {
    await api.post(`/api/admin/clients/${rejectTarget.value.client_id}/review`, {
      action: 'reject',
      reason: rejectReason.value.trim(),
    });
    rejectVisible.value = false;
    ElMessage.success('已拒绝');
    window.dispatchEvent(new Event('console:pending-changed'));
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, '操作失败'));
  } finally {
    rejecting.value = false;
  }
}

function sameOriginRedirect(row: ClientRow): boolean {
  return row.redirect_uris.some((u) => u.startsWith(window.location.origin));
}

/** 发起 PKCE 测试登录（完整授权码流程） */
async function startTestLogin(row: ClientRow) {
  const redirectUri =
    row.redirect_uris.find((u) => u.startsWith(window.location.origin)) || row.redirect_uris[0];
  const { verifier, challenge } = await createPkce();
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem(
    'wb_oidc_pkce',
    JSON.stringify({ verifier, state, clientId: row.client_id, redirectUri }),
  );
  const params = new URLSearchParams({
    client_id: row.client_id,
    response_type: 'code',
    scope: row.scope || 'openid profile email',
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `${ISSUER}/auth?${params.toString()}`;
}

function extractError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  return Array.isArray(msg) ? msg[0] : msg || fallback;
}
</script>

<style scoped>
.stat-grid {
  margin-bottom: 18px;
}
.mt16 {
  margin-top: 16px;
}
.uri-line {
  font-size: 12px;
  color: #666;
  word-break: break-all;
}
.app-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0b57d0, #0a3d91);
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.app-name {
  font-weight: 600;
  color: var(--ink-900);
}
.app-cid {
  margin-top: 2px;
  color: var(--ink-300);
}
</style>
