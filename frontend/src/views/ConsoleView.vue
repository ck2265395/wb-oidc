<template>
  <div class="console-page">
    <el-container>
      <el-header class="header">
        <span class="title">🛠 WB OIDC 开发者控制台</span>
        <el-space :size="12">
          <el-tag v-if="admin" :type="admin.role === 'super_admin' ? 'danger' : 'info'" size="small">
            {{ admin.role === 'super_admin' ? '超级管理员' : '运营' }}
          </el-tag>
          <span class="admin-name">{{ admin?.display_name || admin?.username }}</span>
          <el-button text @click="handleLogout">退出登录</el-button>
        </el-space>
      </el-header>

      <el-main>
        <div>
          <div class="toolbar">
            <el-button type="primary" @click="openCreate">+ 注册新应用</el-button>
            <el-button @click="loadClients">刷新</el-button>
          </div>

          <el-table :data="clients" v-loading="loading" stripe>
            <el-table-column prop="client_name" label="应用名称" min-width="140" />
            <el-table-column prop="client_id" label="client_id" min-width="180" />
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
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="primary"
                  link
                  @click="startTestLogin(row)"
                  :disabled="!sameOriginRedirect(row)"
                >
                  测试登录
                </el-button>
                <el-button size="small" type="warning" link @click="toggle(row)">
                  {{ row.enabled ? '停用' : '启用' }}
                </el-button>
                <el-button size="small" type="danger" link @click="remove(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-main>
    </el-container>

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

    <!-- 凭据展示 -->
    <el-dialog v-model="credentialVisible" title="应用创建成功（凭据仅显示一次）" width="560px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="client_id">
          <el-text copyable>{{ created?.client?.client_id }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item v-if="created?.client_secret" label="client_secret">
          <el-text copyable type="danger">{{ created?.client_secret }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item label="token 鉴权方式">
          {{ created?.client?.token_endpoint_auth_method }}
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        class="mt16"
        type="warning"
        :closable="false"
        title="请立即保存 client_secret，关闭后无法再次查看（可删除应用后重建）"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, {
  AdminInfo,
  ClientRow,
  createPkce,
  fetchMe,
  getCurrentAdmin,
  logout,
  ISSUER,
} from '../api';

const router = useRouter();
const admin = ref<AdminInfo | null>(getCurrentAdmin());
const loading = ref(false);
const clients = ref<ClientRow[]>([]);
const createVisible = ref(false);
const creating = ref(false);
const credentialVisible = ref(false);
const created = ref<{ client: ClientRow; client_secret: string } | null>(null);

const createForm = ref({
  client_name: '',
  redirect_uris_text: '',
  application_type: 'web',
  scopes: ['openid', 'profile'],
});

onMounted(async () => {
  admin.value = (await fetchMe()) || getCurrentAdmin();
  await loadClients();
});

async function handleLogout() {
  try {
    await logout();
  } finally {
    ElMessage.success('已退出登录');
    router.replace('/login');
  }
}

async function tryLoadClients(): Promise<boolean> {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: ClientRow[] }>('/api/admin/clients');
    clients.value = data.data;
    return true;
  } catch {
    return false;
  } finally {
    loading.value = false;
  }
}

async function loadClients() {
  await tryLoadClients();
}

function openCreate() {
  createForm.value = { client_name: '', redirect_uris_text: '', application_type: 'web', scopes: ['openid', 'profile'] };
  createVisible.value = true;
}

async function submitCreate() {
  const uris = createForm.value.redirect_uris_text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  creating.value = true;
  try {
    const { data } = await api.post<{ data: ClientRow; client_secret: string }>(
      '/api/admin/clients',
      {
        client_name: createForm.value.client_name,
        redirect_uris: uris,
        application_type: createForm.value.application_type,
        scope: ['openid', ...createForm.value.scopes.filter((s) => s !== 'openid')].join(' '),
      },
    );
    created.value = data;
    createVisible.value = false;
    credentialVisible.value = true;
    await loadClients();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message?.[0] || e?.response?.data?.message || '创建失败');
  } finally {
    creating.value = false;
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
    await api.delete(`/api/admin/clients/${row.client_id}`);
    await loadClients();
    ElMessage.success('已删除');
  } catch {
    /* 取消 */
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
</script>

<style scoped>
.console-page {
  min-height: 100%;
  background: #f5f7fa;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.title {
  font-size: 18px;
  font-weight: 600;
}
.admin-name {
  color: #606266;
  font-size: 14px;
}
.toolbar {
  margin-bottom: 16px;
}
.auth-card {
  max-width: 420px;
  margin: 60px auto;
  text-align: center;
}
.hint {
  color: #999;
  font-size: 13px;
  margin: 12px 0;
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
