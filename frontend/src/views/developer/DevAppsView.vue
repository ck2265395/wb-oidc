<template>
  <div class="apps-wrap">
    <div class="apps-head">
      <div>
        <h2 class="page-title">我的应用</h2>
        <p class="page-desc">管理你的接入应用：提交申请、查看审核状态、维护回调地址与权限。</p>
      </div>
      <el-button v-if="isApproved" type="primary" size="large" round @click="openCreate">
        + 提交应用申请
      </el-button>
    </div>

    <!-- 开发者资格引导：未通过审核时占用主体区域 -->
    <div v-if="!isApproved" class="gate-card" v-loading="loadingUser">
      <div class="gate-icon"><DevFeatureIcon name="review" /></div>

      <template v-if="dev?.status === 'suspended'">
        <h3 class="gate-title">账号已停用</h3>
        <p class="gate-desc">
          {{ dev?.reject_reason || '请联系平台管理员处理。' }}
        </p>
        <el-tag type="danger" effect="light" round>无法创建应用</el-tag>
      </template>

      <template v-else-if="dev?.developer_status === 'pending'">
        <h3 class="gate-title">开发者资格审核中</h3>
        <p class="gate-desc">
          资料已提交，管理员审核通过后即可创建接入应用。审核期间可以先阅读接入文档，提前完成技术准备。
        </p>
        <div class="gate-info">
          <span>公司 / 团队：<b>{{ dev?.company || '—' }}</b></span>
          <span>联系方式：<b>{{ dev?.contact || '—' }}</b></span>
          <span v-if="dev?.developer_applied_at">提交时间：{{ fmtTime(dev.developer_applied_at) }}</span>
        </div>
        <el-button type="primary" @click="$router.push('/docs')">查看接入文档</el-button>
      </template>

      <template v-else-if="dev?.developer_status === 'rejected'">
        <h3 class="gate-title">开发者资格申请未通过</h3>
        <el-alert
          class="gate-alert"
          type="error"
          :closable="false"
          show-icon
          :title="dev?.developer_reject_reason || '资料不完整，请修改后重新提交'"
        />
        <p class="gate-desc">请更新公司 / 团队与联系方式后重新提交，管理员会再次审核。</p>
        <el-button type="primary" @click="openApply">修改资料并重新提交</el-button>
      </template>

      <template v-else>
        <h3 class="gate-title">申请成为开发者</h3>
        <p class="gate-desc">
          你已注册为平台用户，可以自由浏览文档。若需要创建接入应用，请先补齐开发者资料，
          由管理员审核通过后即可提交应用申请。
        </p>
        <div class="gate-steps">
          <span>① 填写资料</span><span>② 管理员审核</span><span>③ 创建应用</span>
        </div>
        <el-button type="primary" size="large" @click="openApply">申请成为开发者</el-button>
      </template>
    </div>

    <!-- 已通过开发者审核：应用列表 -->
    <div v-else class="apps-card">
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

    <!-- 申请成为开发者 -->
    <el-dialog v-model="applyVisible" title="申请成为开发者" width="520px">
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
        title="提交后由管理员审核，通过后才可创建应用；被驳回可修改资料重新提交。"
      />
      <template #footer>
        <el-button @click="applyVisible = false">取消</el-button>
        <el-button type="primary" :loading="applying" @click="submitApply">提交审核</el-button>
      </template>
    </el-dialog>

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
import devApi, {
  DevAppRow,
  DeveloperInfo,
  devApplyDeveloper,
  devFetchMe,
  extractDevError,
  getCurrentDeveloper,
} from '../../api/dev';
import DevFeatureIcon from './DevFeatureIcon.vue';

const loading = ref(false);
const loadingUser = ref(true);
const apps = ref<DevAppRow[]>([]);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());
const keyword = ref('');

/** 能否管理应用：账号正常 + 开发者资格已通过 */
const isApproved = computed(
  () => dev.value?.status === 'active' && dev.value?.developer_status === 'approved',
);

const filteredApps = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return apps.value;
  return apps.value.filter(
    (a) =>
      a.client_name.toLowerCase().includes(kw) || a.client_id.toLowerCase().includes(kw),
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

onMounted(async () => {
  // 管理员审核结果不体现在旧 token 里，进页面实时拉一次最新状态
  const fresh = await devFetchMe();
  if (fresh) dev.value = fresh;
  loadingUser.value = false;
  if (isApproved.value) await loadApps();
});

async function loadApps() {
  loading.value = true;
  try {
    const { data } = await devApi.get<{ data: DevAppRow[] }>('/api/developer/apps');
    apps.value = data.data;
  } catch {
    // 资格可能在页面打开期间被撤销，回退到引导卡片
    const fresh = await devFetchMe();
    if (fresh) dev.value = fresh;
    apps.value = [];
  } finally {
    loading.value = false;
  }
}

function fmtTime(s?: string | null): string {
  return s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '—';
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
  color: #0b1220;
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.apps-card {
  background: #fff;
  border: 1px solid #e3eaf3;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.04);
}
.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

/* 开发者资格引导卡 */
.gate-card {
  background: #fff;
  border: 1px solid #e3eaf3;
  border-radius: 12px;
  padding: 48px 32px 52px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.04);
  border-top: 3px solid #0b57d0;
}
.gate-icon {
  width: 52px;
  height: 52px;
  padding: 12px;
  box-sizing: border-box;
  margin: 0 auto 20px;
  border: 1px solid #e3eaf3;
  border-radius: 12px;
  background: #f2f7ff;
  color: #0a3d91;
}
.gate-title {
  margin: 0 0 12px;
  font-size: 21px;
  font-weight: 700;
  color: #0b1220;
}
.gate-desc {
  max-width: 560px;
  margin: 0 auto 20px;
  font-size: 14px;
  line-height: 1.8;
  color: #6b7280;
}
.gate-steps {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 28px;
  font-size: 13px;
  color: #0a3d91;
}
.gate-info {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  font-size: 13px;
  color: #6b7280;
}
.gate-info b {
  color: #0b1220;
  font-weight: 600;
}
.gate-alert {
  max-width: 520px;
  margin: 0 auto 16px;
  text-align: left;
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
.mt16 {
  margin-top: 16px;
}
.uri-line {
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
}
</style>
