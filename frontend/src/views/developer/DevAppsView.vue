<template>
  <div>
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

    <div class="toolbar">
      <el-button type="primary" :disabled="dev?.status !== 'active'" @click="openCreate">
        + 提交应用申请
      </el-button>
      <el-button @click="loadApps">刷新</el-button>
    </div>

    <el-table :data="apps" v-loading="loading" stripe>
      <el-table-column prop="client_name" label="应用名称" min-width="140" />
      <el-table-column prop="client_id" label="client_id" min-width="180" />
      <el-table-column label="回调地址" min-width="200">
        <template #default="{ row }">
          <div v-for="u in row.redirect_uris" :key="u" class="uri-line">{{ u }}</div>
        </template>
      </el-table-column>
      <el-table-column label="审核状态" width="110" fixed="right">
        <template #default="{ row }">
          <el-tooltip :content="row.reject_reason" :disabled="!row.reject_reason" placement="top">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
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
        <el-empty description="还没有应用，点击上方按钮提交申请" />
      </template>
    </el-table>

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
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import devApi, { DevAppRow, DeveloperInfo, extractDevError, getCurrentDeveloper } from '../../api/dev';

const loading = ref(false);
const apps = ref<DevAppRow[]>([]);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());

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
.toolbar {
  margin-bottom: 16px;
}
.mb16 {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
}
.uri-line {
  font-size: 12px;
  color: #666;
  word-break: break-all;
}
</style>
