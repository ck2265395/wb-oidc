<template>
  <div class="apps-wrap">
    <div class="apps-head">
      <div>
        <h2 class="page-title">我的应用</h2>
        <p class="page-desc">管理你的接入应用：提交申请、查看审核状态、维护回调地址与权限。</p>
      </div>
      <el-button
        type="primary"
        size="large"
        round
        :disabled="dev?.status !== 'active'"
        @click="openCreate"
      >
        + 提交应用申请
      </el-button>
    </div>

    <div class="apps-card">
      <div class="card-toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜索应用名称或 client_id"
          clearable
          :prefix-icon="Search"
          style="width: 280px"
        />
        <el-button text type="primary" @click="loadApps">刷新</el-button>
      </div>

      <el-alert
        v-if="dev && dev.status === 'pending'"
        class="mb16"
        type="warning"
        :closable="false"
        title="账号正在审核中，审核通过后即可创建应用。"
      />
      <el-alert
        v-if="dev && dev.status === 'suspended'"
        class="mb16"
        type="error"
        :closable="false"
        :title="`账号已停用：${dev.reject_reason || '请联系管理员'}`"
      />

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
          <el-empty description="还没有应用，点击右上角提交第一个申请" />
        </template>
      </el-table>
    </div>

    <!-- 提交应用申请 -->
    <el-dialog v-model="createVisible" title="提交应用申请" width="520px">
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
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import devApi, { DevAppRow, DeveloperInfo, extractDevError, getCurrentDeveloper } from '../../api/dev';

const loading = ref(false);
const apps = ref<DevAppRow[]>([]);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());
const keyword = ref('');

const filteredApps = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return apps.value;
  return apps.value.filter(
    (a) =>
      a.client_name.toLowerCase().includes(kw) || a.client_id.toLowerCase().includes(kw),
  );
});

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

onMounted(() => {
  dev.value = getCurrentDeveloper() || dev.value;
  loadApps();
});

async function loadApps() {
  loading.value = true;
  try {
    const { data } = await devApi.get<{ data: DevAppRow[] }>('/api/developer/apps');
    apps.value = data.data;
  } finally {
    loading.value = false;
  }
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
.apps-wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}
.apps-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
}
.apps-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(17, 24, 39, 0.04);
}
.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
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
  color: #111827;
  font-size: 14px;
}
.app-cid {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
}
.mb16 {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
}
.uri-line {
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
}
</style>
