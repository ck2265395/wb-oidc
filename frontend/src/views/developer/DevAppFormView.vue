<template>
  <div class="app-form-page">
    <!-- 页头 -->
    <div class="page-head">
      <div class="head-left">
        <el-button link :icon="ArrowLeft" class="back-btn" @click="goBack">返回工作台</el-button>
        <h2 class="page-title">{{ isEdit ? '编辑应用' : '新建应用' }}</h2>
        <p class="page-desc">
          {{
            isEdit
              ? '修改应用信息；回调地址或 scope 变更后，应用会重新进入待审核状态。'
              : '填写应用信息，提交后由管理员审核，通过后即可发起 OIDC 登录。'
          }}
        </p>
      </div>
    </div>

    <!-- 创建成功：凭据常驻面板（比弹窗更不容易被误关） -->
    <section v-if="credential" class="panel credential-panel">
      <div class="cred-head">
        <el-icon class="cred-icon"><CircleCheckFilled /></el-icon>
        <div>
          <h3>应用已提交审核</h3>
          <p>把下面的凭据复制到你的应用配置中，之后也可以随时在应用设置里重新查看。</p>
        </div>
      </div>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="client_id">
          <el-text copyable>{{ credential.client_id }}</el-text>
        </el-descriptions-item>
        <el-descriptions-item v-if="credential.secret" label="client_secret">
          <el-text copyable type="danger">{{ credential.secret }}</el-text>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        class="mt16"
        type="info"
        :closable="false"
        show-icon
        title="client_secret 已加密存储，可在「编辑应用 → 接入配置」中随时查看（需验证登录密码，并记录审计日志）。"
      />
      <div class="cred-actions">
        <el-button @click="goBack">返回工作台</el-button>
        <el-button type="primary" @click="goNewAgain">再建一个应用</el-button>
      </div>
    </section>

    <!-- 无法操作时的提示 -->
    <el-alert
      v-else-if="!loading && !canProceed"
      class="guard-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="guardTitle"
    >
      <template #default>
        <span>{{ guardText }}</span>
        <el-button link type="primary" class="guard-link" @click="$router.push(`/profile/edit?redirect=${encodeURIComponent(route.fullPath)}`)">
          前往完善开发者资料 →
        </el-button>
      </template>
    </el-alert>

    <!-- 表单 -->
    <section v-if="!credential" class="panel" v-loading="loading">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="app-form"
      >
        <h3 class="section-title">基本信息</h3>
        <div class="grid-2">
          <el-form-item label="应用名称" prop="client_name">
            <el-input v-model="form.client_name" maxlength="64" placeholder="例如：小鹅砍价小程序" />
          </el-form-item>
          <el-form-item label="应用类目" prop="category">
            <el-select v-model="form.category" placeholder="选择应用类目" class="full">
              <el-option label="网站应用" value="web_app" />
              <el-option label="移动应用" value="mobile_app" />
              <el-option label="小程序" value="mini_program" />
            </el-select>
            <div class="form-hint">网站应用走 client_secret；移动应用 / 小程序走 PKCE，无需 secret。</div>
          </el-form-item>
        </div>

        <div class="grid-logo">
          <el-form-item label="应用图标（100×100）">
            <div class="logo-upload" @click="pickLogo">
              <img v-if="form.logo" :src="form.logo" class="logo-preview" alt="应用图标" />
              <el-icon v-else class="logo-plus"><Plus /></el-icon>
              <span v-if="form.logo" class="logo-clear" @click.stop="form.logo = ''">移除</span>
            </div>
          </el-form-item>
          <el-form-item label="应用简介">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="一句话介绍这个应用（200 字以内）"
            />
          </el-form-item>
        </div>

        <el-form-item label="官网域名">
          <el-input v-model="form.website" placeholder="https://www.example.com" />
        </el-form-item>

        <h3 class="section-title">接入配置</h3>

        <!-- 已有应用的凭据：client_secret 默认遮挡，查看需二次验证密码 -->
        <div v-if="isEdit" class="cred-box">
          <div class="cred-line">
            <span class="cred-label">client_id</span>
            <el-text copyable class="cred-value">{{ clientId }}</el-text>
          </div>
          <div v-if="hasSecret" class="cred-line">
            <span class="cred-label">client_secret</span>
            <span class="cred-value mono">{{ revealedSecret || '••••••••••••••••••••' }}</span>
            <el-button v-if="!revealedSecret" size="small" :loading="revealing" @click="askPassword">
              查看
            </el-button>
            <template v-else>
              <el-button size="small" text type="primary" @click="copySecret">复制</el-button>
              <el-button size="small" @click="revealedSecret = ''">隐藏</el-button>
            </template>
          </div>
          <div v-else class="cred-line">
            <span class="cred-label">client_secret</span>
            <span class="cred-value muted">该应用使用 PKCE，无 client_secret</span>
          </div>
          <div class="form-hint">
            查看密钥需重新输入登录密码；每次查看都会记录审计日志（谁、何时、从哪个 IP）。
          </div>
        </div>

        <el-form-item label="回调地址（每行一个）" prop="redirect_uris_text">
          <el-input
            v-model="form.redirect_uris_text"
            type="textarea"
            :rows="3"
            placeholder="https://app.example.com/auth/callback"
          />
          <div class="form-hint">必须为 http(s):// 开头的完整地址，可填多个，每行一个。</div>
        </el-form-item>

        <el-form-item v-if="!isEdit" label="申请的 scopes">
          <el-checkbox-group v-model="form.scopes">
            <el-checkbox value="profile">profile</el-checkbox>
            <el-checkbox value="email">email</el-checkbox>
            <el-checkbox value="phone">phone</el-checkbox>
          </el-checkbox-group>
          <div class="form-hint">固定包含 openid，其余按需勾选。</div>
        </el-form-item>
        <el-form-item v-else label="scopes（空格分隔，必须含 openid）">
          <el-input v-model="form.scope" placeholder="openid profile email" />
        </el-form-item>

        <h3 class="section-title">资质与归类</h3>
        <el-form-item :label="isEnterprise ? 'ICP 备案号' : 'ICP 备案号（选填）'" :required="isEnterprise">
          <el-input
            v-model="form.icp_number"
            :placeholder="isEnterprise ? '京ICP备XXXXXXXX号' : '选填，企业开发者必填'"
          />
          <div v-if="isEnterprise" class="form-hint">
            企业开发者创建应用必须填写 ICP 备案号（提供方：{{ dev?.company || '—' }}）。
          </div>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags_text" placeholder="用逗号分隔，如：内部工具, 数据看板" />
        </el-form-item>

        <el-form-item v-if="!isEdit" required>
          <el-checkbox v-model="agreed">我已阅读并同意《开发者协议》</el-checkbox>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="!isEdit"
        type="info"
        :closable="false"
        title="提交后进入待审核状态，管理员审核通过后应用才能发起 OIDC 登录。"
      />
      <el-alert
        v-else
        type="warning"
        :closable="false"
        title="修改回调地址或 scope 后，应用会回到待审核状态，需管理员重新审核。"
      />

      <div class="form-actions">
        <el-button @click="goBack">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!canProceed"
          @click="submit"
        >
          {{ isEdit ? '保存修改' : '提交申请' }}
        </el-button>
      </div>
    </section>

    <input ref="logoInput" type="file" accept="image/*" hidden @change="onLogoPicked" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { ArrowLeft, Plus, CircleCheckFilled } from '@element-plus/icons-vue';
import { fileToLogo } from '../../utils/logo';
import devApi, {
  DeveloperInfo,
  devFetchMe,
  extractDevError,
  getCurrentDeveloper,
} from '../../api/dev';

const route = useRoute();
const router = useRouter();

const clientId = String(route.params.clientId || '');
const isEdit = computed(() => !!clientId);

const loading = ref(true);
const submitting = ref(false);
const agreed = ref(false);
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());
const appStatus = ref<string>('');
const credential = ref<{ client_id: string; secret: string } | null>(null);
const formRef = ref<FormInstance>();
const logoInput = ref<HTMLInputElement | null>(null);
/** 该应用是否使用 client_secret（PKCE 类目没有） */
const hasSecret = ref(true);
/** 明文密钥只放内存，离开页面/刷新即清空 */
const revealedSecret = ref('');
const revealing = ref(false);
/** 进入页面时的类目，用于判断保存后安全形态是否变化 */
const originalCategory = ref<'web_app' | 'mobile_app' | 'mini_program' | ''>('');

const isEnterprise = computed(() => dev.value?.developer_type === 'enterprise');

const canProceed = computed(() => {
  if (!dev.value) return false;
  if (dev.value.status === 'suspended') return false;
  if (dev.value.developer_status !== 'approved') return false;
  if (isEdit.value && appStatus.value === 'pending') return false;
  return true;
});

const guardTitle = computed(() => {
  if (dev.value?.status === 'suspended') return '账号已停用';
  if (dev.value?.developer_status !== 'approved') return '尚未具备开发者资格';
  if (isEdit.value && appStatus.value === 'pending') return '应用正在审核中';
  return '暂不能操作';
});
const guardText = computed(() => {
  if (dev.value?.status === 'suspended') {
    return dev.value?.reject_reason || '账号已被管理员停用，无法创建或修改应用。';
  }
  if (dev.value?.developer_status !== 'approved') {
    return '创建应用需要开发者资格，请先完善资料并提交审核。';
  }
  if (isEdit.value && appStatus.value === 'pending') {
    return '应用正在审核中，暂不能修改。请等待管理员审核完成后再编辑。';
  }
  return '';
});

const form = ref({
  client_name: '',
  redirect_uris_text: '',
  category: 'web_app' as 'web_app' | 'mobile_app' | 'mini_program',
  logo: '',
  description: '',
  website: '',
  icp_number: '',
  tags_text: '',
  scopes: ['profile'] as string[],
  scope: 'openid profile',
});

function parseUris(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseTags(text: string): string[] {
  return text ? text.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [];
}

function validateUris(_rule: unknown, value: string, cb: (e?: Error) => void) {
  const uris = parseUris(value || '');
  if (!uris.length) return cb(new Error('请至少填写一个回调地址'));
  for (const u of uris) {
    if (!/^https?:\/\/.+/i.test(u)) return cb(new Error(`回调地址不合法：${u}`));
  }
  cb();
}

const rules: FormRules = {
  client_name: [
    { required: true, message: '请填写应用名称', trigger: 'blur' },
    { max: 64, message: '不超过 64 个字符', trigger: 'blur' },
  ],
  category: [{ required: true, message: '请选择应用类目', trigger: 'change' }],
  redirect_uris_text: [{ validator: validateUris, trigger: 'blur' }],
};

function pickLogo() {
  logoInput.value?.click();
}
async function onLogoPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    form.value.logo = await fileToLogo(file);
  } catch (err: any) {
    ElMessage.error(err?.message || '图标处理失败');
  }
}

onMounted(async () => {
  try {
    const fresh = await devFetchMe();
    if (fresh) dev.value = fresh;
    if (isEdit.value) await loadApp();
  } finally {
    loading.value = false;
  }
});

async function loadApp() {
  try {
    const { data } = await devApi.get<{ data: any }>(`/api/developer/apps/${clientId}`);
    const row = data.data;
    appStatus.value = row.status;
    hasSecret.value = row.token_endpoint_auth_method !== 'none';
    originalCategory.value = row.category || 'web_app';
    form.value = {
      client_name: row.client_name || '',
      redirect_uris_text: (row.redirect_uris || []).join('\n'),
      category: row.category || 'web_app',
      logo: row.logo || '',
      description: row.description || '',
      website: row.website || '',
      icp_number: row.icp_number || '',
      tags_text: (row.tags || []).join(', '),
      scopes: [],
      scope: row.scope || 'openid profile',
    };
  } catch (e) {
    ElMessage.error(extractDevError(e, '应用加载失败'));
    router.replace('/apps');
  }
}

function goBack() {
  router.push('/apps');
}
function goNewAgain() {
  credential.value = null;
  router.replace('/apps/new');
}

/** 查看 client_secret：先验证登录密码，再向服务端要明文（服务端会写审计日志） */
async function askPassword() {
  let pwd = '';
  try {
    const { value } = await ElMessageBox.prompt(
      `密钥以加密形式存储，查看时需验证身份。请输入账号 ${dev.value?.email || ''} 的登录密码。`,
      '验证身份以查看密钥',
      {
        confirmButtonText: '确认查看',
        cancelButtonText: '取消',
        inputType: 'password',
        inputPlaceholder: '登录密码',
        inputValidator: (v: string) => (v && v.length > 0 ? true : '请输入登录密码'),
      },
    );
    pwd = value;
  } catch {
    return; // 用户取消
  }

  revealing.value = true;
  try {
    const { data } = await devApi.post<{ data: { client_secret: string | null } }>(
      `/api/developer/apps/${clientId}/reveal-secret`,
      { password: pwd },
    );
    if (!data.data.client_secret) {
      hasSecret.value = false;
      ElMessage.warning('该应用使用 PKCE 授权，没有 client_secret');
      return;
    }
    revealedSecret.value = data.data.client_secret;
  } catch (e) {
    ElMessage.error(extractDevError(e, '身份验证失败，请稍后重试'));
  } finally {
    revealing.value = false;
  }
}

/** 复制已查看的明文密钥 */
async function copySecret() {
  if (!revealedSecret.value) return;
  try {
    await navigator.clipboard.writeText(revealedSecret.value);
    ElMessage.success('已复制到剪贴板');
  } catch {
    ElMessage.warning('当前浏览器不允许自动复制，请手动选中复制');
  }
}

async function submit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  if (isEnterprise.value && !form.value.icp_number.trim()) {
    ElMessage.warning('企业开发者必须填写 ICP 备案号');
    return;
  }
  if (!isEdit.value && !agreed.value) {
    ElMessage.warning('请先阅读并同意《开发者协议》');
    return;
  }
  const uris = parseUris(form.value.redirect_uris_text);
  submitting.value = true;
  try {
    if (isEdit.value) {
      await devApi.patch(`/api/developer/apps/${clientId}`, {
        client_name: form.value.client_name,
        redirect_uris: uris,
        category: form.value.category,
        logo: form.value.logo || undefined,
        description: form.value.description || undefined,
        website: form.value.website || undefined,
        icp_number: form.value.icp_number || undefined,
        tags: parseTags(form.value.tags_text),
        scope: form.value.scope,
      });
      // 类目切换会改变安全形态：从 PKCE 改成网站应用会补发新密钥，此时留在页面让用户能查看
      const wasPkce = originalCategory.value !== '' && originalCategory.value !== 'web_app';
      const nowWeb = form.value.category === 'web_app';
      if (wasPkce && nowWeb) {
        revealedSecret.value = '';
        await loadApp();
        ElMessage.warning(
          '已保存。类目改为网站应用，系统已生成新的 client_secret，请点「查看」复制到你的应用配置中。',
        );
        return;
      }
      if (!nowWeb && originalCategory.value === 'web_app') {
        ElMessage.success('已保存。类目改为移动 / 小程序，client_secret 已停用（改用 PKCE）。');
        router.push('/apps');
        return;
      }
      ElMessage.success('已保存，应用进入待审核状态');
      router.push('/apps');
    } else {
      const { data } = await devApi.post<{
        data: any;
        client_id: string;
        client_secret: string;
      }>('/api/developer/apps', {
        client_name: form.value.client_name,
        redirect_uris: uris,
        category: form.value.category,
        logo: form.value.logo || undefined,
        description: form.value.description || undefined,
        website: form.value.website || undefined,
        icp_number: form.value.icp_number || undefined,
        tags: parseTags(form.value.tags_text),
        scope: ['openid', ...form.value.scopes].join(' '),
      });
      credential.value = { client_id: data.client_id, secret: data.client_secret };
    }
  } catch (e) {
    ElMessage.error(extractDevError(e, isEdit.value ? '保存失败' : '提交失败'));
    await devFetchMe().then((fresh) => {
      if (fresh) dev.value = fresh;
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.app-form-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}
.page-head {
  margin-bottom: 20px;
}
.back-btn {
  margin-bottom: 10px;
  color: #6b7280;
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
  line-height: 1.7;
}

.panel {
  background: #fff;
  border: 1px solid #e3eaf3;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.04);
}
.section-title {
  margin: 4px 0 18px;
  padding-left: 10px;
  border-left: 3px solid #0b57d0;
  font-size: 15px;
  font-weight: 700;
  color: #0b1220;
}
.section-title:not(:first-child) {
  margin-top: 8px;
}
.app-form :deep(.el-form-item) {
  margin-bottom: 20px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
}
.grid-logo {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 0 24px;
}
.full {
  width: 100%;
}
.form-hint {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #8a93a6;
}
.cred-box {
  margin-bottom: 20px;
  padding: 14px 16px 10px;
  background: #f7f9fc;
  border: 1px solid #e3eaf3;
  border-radius: 10px;
}
.cred-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.cred-label {
  flex: none;
  width: 104px;
  font-size: 12px;
  color: #8a93a6;
}
.cred-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #0b1220;
}
.cred-value.muted {
  font-family: inherit;
  color: #a0a8b8;
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
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #eef2f7;
}

/* 凭据面板 */
.credential-panel {
  border-top: 3px solid #16a34a;
}
.cred-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}
.cred-icon {
  font-size: 30px;
  color: #16a34a;
  margin-top: 2px;
}
.cred-head h3 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: #0b1220;
}
.cred-head p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.cred-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
.mt16 {
  margin-top: 16px;
}
.guard-alert {
  margin-bottom: 20px;
}
.guard-link {
  margin-left: 6px;
  padding: 0;
}

@media (max-width: 768px) {
  .grid-2,
  .grid-logo {
    grid-template-columns: 1fr;
  }
}
</style>
