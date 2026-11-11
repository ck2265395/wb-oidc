<template>
  <ConsolePage
    eyebrow="APPLICATIONS"
    :title="t('console.clients.title')"
    :desc="t('console.clients.desc')"
  >
    <template #actions>
      <el-button :icon="Refresh" @click="loadClients">{{ t('console.common.refresh') }}</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">{{ t('console.clients.registerNew') }}</el-button>
    </template>

    <el-row :gutter="16" class="stat-grid">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">{{ t('console.clients.statTotal') }}</div>
              <div class="stat-value">{{ clients.length }}</div>
              <div class="stat-sub">{{ t('console.clients.statTotalSub') }}</div>
            </div>
            <div class="stat-icon"><el-icon><Grid /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">{{ t('console.common.pending') }}</div>
              <div class="stat-value">{{ pendingClients }}</div>
              <div class="stat-sub">{{ t('console.clients.statPendingSub') }}</div>
            </div>
            <div class="stat-icon warn"><el-icon><Bell /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">{{ t('console.common.approved') }}</div>
              <div class="stat-value">{{ approvedClients }}</div>
              <div class="stat-sub">{{ t('console.clients.statApprovedSub') }}</div>
            </div>
            <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-flex">
            <div>
              <div class="stat-label">{{ t('console.clients.statEnabled') }}</div>
              <div class="stat-value">{{ enabledClients }}</div>
              <div class="stat-sub">{{ t('console.clients.statEnabledSub') }}</div>
            </div>
            <div class="stat-icon"><el-icon><Key /></el-icon></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="box-card">
      <div class="cp-toolbar">
        <el-radio-group v-model="statusFilter">
          <el-radio-button value="">{{ t('console.common.all') }}</el-radio-button>
          <el-radio-button value="pending">{{ t('console.common.pending') }}</el-radio-button>
          <el-radio-button value="approved">{{ t('console.common.approved') }}</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="categoryFilter" class="ml12">
          <el-radio-button value="">{{ t('console.clients.allCategories') }}</el-radio-button>
          <el-radio-button value="web_app">{{ t('console.clients.catWeb') }}</el-radio-button>
          <el-radio-button value="mobile_app">{{ t('console.clients.catMobile') }}</el-radio-button>
          <el-radio-button value="mini_program">{{ t('console.clients.catMini') }}</el-radio-button>
        </el-radio-group>
        <div class="spacer" />
        <el-tag v-if="pendingClients" type="warning" effect="light" round size="large">
          {{ t('console.clients.pendingTag', { n: pendingClients }) }}
        </el-tag>
      </div>

    <el-table :data="filteredClients" v-loading="loading" stripe>
      <el-table-column :label="t('console.clients.colApp')" min-width="200">
        <template #default="{ row }">
          <div class="app-cell">
            <div class="app-avatar">
              <img v-if="row.logo" :src="row.logo" alt="" class="app-avatar-img" />
              <span v-else>{{ (row.client_name || '?').slice(0, 1) }}</span>
            </div>
            <div>
              <div class="app-name">{{ row.client_name }}</div>
              <div class="app-cid mono">{{ row.client_id }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="developer_email" :label="t('console.clients.colApplicant')" min-width="160">
        <template #default="{ row }">
          <span v-if="row.developer_email">{{ row.developer_email }}</span>
          <el-tag v-else size="small" type="info">{{ t('console.clients.platformCreated') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('console.clients.colCategory')" width="110">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ categoryLabel(row.category) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('console.clients.colRedirects')" min-width="220">
        <template #default="{ row }">
          <div v-for="u in row.redirect_uris" :key="u" class="uri-line">{{ u }}</div>
        </template>
      </el-table-column>
      <el-table-column :label="t('console.common.status')" width="90">
        <template #default="{ row }">
          <el-tooltip :content="row.reject_reason" :disabled="!row.reject_reason" placement="top">
            <el-tag :type="reviewTag(row)" size="small">{{ reviewText(row) }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column :label="t('console.common.actions')" width="330" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="success" @click="doReview(row, 'approve')">{{ t('console.common.approve') }}</el-button>
            <el-button size="small" type="danger" @click="doReview(row, 'reject')">{{ t('console.common.reject') }}</el-button>
          </template>
          <el-button
            size="small"
            type="primary"
            link
            @click="startTestLogin(row)"
            :disabled="!sameOriginRedirect(row)"
          >
            {{ t('console.clients.testLogin') }}
          </el-button>
          <el-button size="small" link @click="openEdit(row)">{{ t('console.common.edit') }}</el-button>
          <el-button
            v-if="row.application_type !== 'spa'"
            size="small"
            type="warning"
            link
            @click="doRotate(row)"
          >
            {{ t('console.clients.rotateSecret') }}
          </el-button>
          <el-button size="small" type="warning" link @click="toggle(row)">
            {{ row.enabled ? t('console.common.disable') : t('console.common.enable') }}
          </el-button>
          <el-button size="small" type="danger" link @click="remove(row)">{{ t('console.common.remove') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    </el-card>

    <!-- 创建应用 -->
    <el-dialog v-model="createVisible" :title="t('console.clients.registerNew')" width="560px">
      <el-form label-position="top">
        <el-form-item :label="t('console.clients.formName')" required>
          <el-input v-model="createForm.client_name" :placeholder="t('console.clients.namePlaceholder')" maxlength="64" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formLogo')">
          <div class="logo-upload" @click="openLogoPicker('create')">
            <img v-if="createForm.logo" :src="createForm.logo" class="logo-preview" :alt="t('console.clients.logoAlt')" />
            <el-icon v-else class="logo-plus"><Plus /></el-icon>
            <span v-if="createForm.logo" class="logo-clear" @click.stop="createForm.logo = ''">{{ t('console.clients.removeLogo') }}</span>
          </div>
        </el-form-item>
        <el-form-item :label="t('console.clients.formCategory')" required>
          <el-select v-model="createForm.category" :placeholder="t('console.clients.categoryPlaceholder')">
            <el-option :label="t('console.clients.catWeb')" value="web_app" />
            <el-option :label="t('console.clients.catMobile')" value="mobile_app" />
            <el-option :label="t('console.clients.catMini')" value="mini_program" />
          </el-select>
          <div class="form-hint">{{ t('console.clients.categoryHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('console.clients.formDesc')">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            :placeholder="t('console.clients.descPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('console.clients.formWebsite')">
          <el-input v-model="createForm.website" placeholder="https://www.example.com" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formRedirects')" required>
          <el-input
            v-model="createForm.redirect_uris_text"
            type="textarea"
            :rows="3"
            placeholder="https://app.example.com/auth/callback"
          />
        </el-form-item>
        <el-form-item :label="t('console.clients.formIcp')">
          <el-input v-model="createForm.icp_number" :placeholder="t('console.clients.icpPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formTags')">
          <el-input
            v-model="createForm.tags_text"
            :placeholder="t('console.clients.tagsPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('console.clients.formScopes')">
          <el-checkbox-group v-model="createForm.scopes">
            <el-checkbox value="openid">openid</el-checkbox>
            <el-checkbox value="profile">profile</el-checkbox>
            <el-checkbox value="email">email</el-checkbox>
            <el-checkbox value="phone">phone</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">{{ t('console.common.create') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑应用 -->
    <el-dialog v-model="editVisible" :title="t('console.clients.editTitle')" width="560px">
      <el-form label-position="top">
        <el-form-item :label="t('console.clients.formName')" required>
          <el-input v-model="editForm.client_name" maxlength="64" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formLogo')">
          <div class="logo-upload" @click="openLogoPicker('edit')">
            <img v-if="editForm.logo" :src="editForm.logo" class="logo-preview" :alt="t('console.clients.logoAlt')" />
            <el-icon v-else class="logo-plus"><Plus /></el-icon>
            <span v-if="editForm.logo" class="logo-clear" @click.stop="editForm.logo = ''">{{ t('console.clients.removeLogo') }}</span>
          </div>
        </el-form-item>
        <el-form-item :label="t('console.clients.formCategory')" required>
          <el-select v-model="editForm.category" :placeholder="t('console.clients.categoryPlaceholder')">
            <el-option :label="t('console.clients.catWeb')" value="web_app" />
            <el-option :label="t('console.clients.catMobile')" value="mobile_app" />
            <el-option :label="t('console.clients.catMini')" value="mini_program" />
          </el-select>
          <div class="form-hint">{{ t('console.clients.categoryEditHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('console.clients.formDesc')">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            :placeholder="t('console.clients.descPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('console.clients.formWebsite')">
          <el-input v-model="editForm.website" placeholder="https://www.example.com" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formRedirects')" required>
          <el-input v-model="editForm.redirect_uris_text" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formIcp')">
          <el-input v-model="editForm.icp_number" :placeholder="t('console.clients.icpPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formTags')">
          <el-input v-model="editForm.tags_text" :placeholder="t('console.clients.tagsPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('console.clients.formScopeEdit')">
          <el-input v-model="editForm.scope" placeholder="openid profile email" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="primary" :loading="editing" @click="submitEdit">{{ t('console.common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 凭据展示（创建/轮换共用，仅显示一次） -->
    <el-dialog v-model="credentialVisible" :title="t('console.clients.credentialTitle')" width="560px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="client_id">
          <el-text copyable>{{ credential?.client_id }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.clients.secretNew')">
          <el-text copyable type="danger">{{ credential?.secret }}</el-text>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        class="mt16"
        type="warning"
        :closable="false"
        :title="t('console.clients.credentialAlert')"
      />
    </el-dialog>

    <!-- 拒绝理由 -->
    <el-dialog v-model="rejectVisible" :title="t('console.clients.rejectTitle')" width="440px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        :placeholder="t('console.clients.rejectPlaceholder')"
      />
      <template #footer>
        <el-button @click="rejectVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="danger" :loading="rejecting" @click="submitReject">{{ t('console.clients.confirmReject') }}</el-button>
      </template>
    </el-dialog>

    <input ref="logoInput" type="file" accept="image/*" hidden @change="onLogoPicked" />
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
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
import { fileToLogo } from '../../utils/logo';

const { t } = useI18n();
const loading = ref(false);
const clients = ref<ClientRow[]>([]);
const statusFilter = ref('');
const categoryFilter = ref('');
const rejectVisible = ref(false);
const rejectReason = ref('');
const rejecting = ref(false);
const rejectTarget = ref<ClientRow | null>(null);
const createVisible = ref(false);
const logoTarget = ref<'create' | 'edit'>('create');
const logoInput = ref<HTMLInputElement | null>(null);

const filteredClients = computed(() =>
  clients.value.filter((c) => {
    if (statusFilter.value && c.status !== statusFilter.value) return false;
    if (categoryFilter.value && c.category !== categoryFilter.value) return false;
    return true;
  }),
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
  category: 'web_app' as const,
  logo: '',
  description: '',
  website: '',
  icp_number: '',
  tags_text: '',
  scopes: ['openid', 'profile'],
});
const editForm = ref({
  client_name: '',
  redirect_uris_text: '',
  category: 'web_app' as const,
  logo: '',
  description: '',
  website: '',
  icp_number: '',
  tags_text: '',
  scope: '',
});

const CATEGORY_KEYS: Record<string, string> = {
  web_app: 'console.clients.catWeb',
  mobile_app: 'console.clients.catMobile',
  mini_program: 'console.clients.catMini',
};

function categoryLabel(cat?: string): string {
  return t((cat && CATEGORY_KEYS[cat]) || 'console.clients.catWeb');
}

function openLogoPicker(target: 'create' | 'edit') {
  logoTarget.value = target;
  logoInput.value?.click();
}

async function onLogoPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const dataUrl = await fileToLogo(file);
    if (logoTarget.value === 'create') createForm.value.logo = dataUrl;
    else editForm.value.logo = dataUrl;
  } catch (err: any) {
    ElMessage.error(err?.message || t('console.clients.logoError'));
  }
}

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
    category: 'web_app',
    logo: '',
    description: '',
    website: '',
    icp_number: '',
    tags_text: '',
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
        category: createForm.value.category,
        logo: createForm.value.logo || undefined,
        description: createForm.value.description || undefined,
        website: createForm.value.website || undefined,
        icp_number: createForm.value.icp_number || undefined,
        tags: createForm.value.tags_text
          ? createForm.value.tags_text.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
          : [],
        scope: ['openid', ...createForm.value.scopes.filter((s) => s !== 'openid')].join(' '),
      },
    );
    createVisible.value = false;
    credential.value = { client_id: data.data.client_id, secret: data.client_secret };
    credentialVisible.value = true;
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, t('console.clients.createFailed')));
  } finally {
    creating.value = false;
  }
}

function openEdit(row: ClientRow) {
  editingId.value = row.client_id;
  editForm.value = {
    client_name: row.client_name,
    redirect_uris_text: row.redirect_uris.join('\n'),
    category: row.category || 'web_app',
    logo: row.logo || '',
    description: row.description || '',
    website: row.website || '',
    icp_number: row.icp_number || '',
    tags_text: (row.tags || []).join(', '),
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
      category: editForm.value.category,
      logo: editForm.value.logo || undefined,
      description: editForm.value.description || undefined,
      website: editForm.value.website || undefined,
      icp_number: editForm.value.icp_number || undefined,
      tags: editForm.value.tags_text
        ? editForm.value.tags_text.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
        : [],
      scope: editForm.value.scope,
    });
    editVisible.value = false;
    ElMessage.success(t('console.common.saved'));
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, t('console.clients.saveFailed')));
  } finally {
    editing.value = false;
  }
}

async function doRotate(row: ClientRow) {
  try {
    await ElMessageBox.confirm(
      t('console.clients.rotateConfirm', { name: row.client_name }),
      t('console.clients.rotateSecret'),
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
    ElMessage.error(extractError(e, t('console.clients.rotateFailed')));
  }
}

async function toggle(row: ClientRow) {
  await api.patch(`/api/admin/clients/${row.client_id}/enabled/${!row.enabled}`);
  await loadClients();
}

async function remove(row: ClientRow) {
  try {
    await ElMessageBox.confirm(t('console.clients.deleteConfirm', { name: row.client_name }), t('console.clients.deleteTitle'), {
      type: 'warning',
    });
  } catch {
    return;
  }
  await api.delete(`/api/admin/clients/${row.client_id}`);
  await loadClients();
  ElMessage.success(t('console.clients.deleted'));
}

function reviewTag(row: ClientRow): string {
  if (row.status === 'pending') return 'warning';
  if (row.status === 'approved') return row.enabled ? 'success' : 'info';
  return 'danger';
}

function reviewText(row: ClientRow): string {
  const map: Record<string, string> = {
    pending: t('console.common.pending'),
    approved: row.enabled ? t('console.common.enable') : t('console.clients.statusDisabled'),
    rejected: t('console.clients.rejected'),
    suspended: t('console.clients.statusDisabled'),
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
    await ElMessageBox.confirm(t('console.clients.approveConfirm', { name: row.client_name }), t('console.common.reviewConfirmTitle'), {
      type: 'success',
    });
  } catch {
    return;
  }
  await api.post(`/api/admin/clients/${row.client_id}/review`, { action: 'approve' });
  ElMessage.success(t('console.clients.reviewApproved'));
  window.dispatchEvent(new Event('console:pending-changed'));
  await loadClients();
}

async function submitReject() {
  if (!rejectTarget.value || !rejectReason.value.trim()) {
    ElMessage.warning(t('console.clients.rejectReasonRequired'));
    return;
  }
  rejecting.value = true;
  try {
    await api.post(`/api/admin/clients/${rejectTarget.value.client_id}/review`, {
      action: 'reject',
      reason: rejectReason.value.trim(),
    });
    rejectVisible.value = false;
    ElMessage.success(t('console.clients.rejected'));
    window.dispatchEvent(new Event('console:pending-changed'));
    await loadClients();
  } catch (e: any) {
    ElMessage.error(extractError(e, t('console.common.opFailed')));
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
.ml12 {
  margin-left: 12px;
}
.cp-toolbar .el-radio-group {
  margin-right: 0;
}
.form-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-300, #8a93a6);
}
.logo-upload {
  position: relative;
  width: 100px;
  height: 100px;
  border: 1px dashed #cdd5e3;
  border-radius: 12px;
  background: #f7f9fc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s;
}
.logo-upload:hover {
  border-color: #0b57d0;
}
.logo-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.logo-plus {
  font-size: 26px;
  color: #b3bdce;
}
.logo-clear {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 2px 8px;
  font-size: 12px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border-top-left-radius: 8px;
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
  overflow: hidden;
}
.app-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
