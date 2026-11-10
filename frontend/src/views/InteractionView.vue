<template>
  <div class="interaction-page">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span class="brand">🔐 统一身份认证</span>
        </div>
      </template>

      <div v-if="loading" class="center">
        <el-skeleton :rows="4" animated />
      </div>

      <div v-else-if="error" class="center">
        <el-result icon="error" title="出错了" :sub-title="error">
          <template #extra>
            <el-button @click="reload">重试</el-button>
          </template>
        </el-result>
      </div>

      <!-- 登录 -->
      <div v-else-if="details?.prompt?.name === 'login'">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="mb16"
          :title="`「${details.client.client_name}」请求登录`"
          :description="`登录后将授权该应用获取你的部分账号信息`"
        />
        <el-form label-position="top" @submit.prevent>
          <el-form-item label="用户名 / 账号">
            <el-input v-model="loginForm.username" placeholder="请输入用户名" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="loginForm.password"
              type="password"
              show-password
              placeholder="请输入密码"
              @keyup.enter="submitLogin"
            />
          </el-form-item>
          <el-checkbox v-model="loginForm.remember">记住登录（14 天内免登录）</el-checkbox>
          <el-button
            type="primary"
            class="full-btn mt16"
            :loading="submitting"
            @click="submitLogin"
          >
            登录并继续
          </el-button>
        </el-form>
      </div>

      <!-- 授权确认 -->
      <div v-else-if="details?.prompt?.name === 'consent'">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="mb16"
          :title="`「${details.client.client_name}」申请获取以下权限`"
        />
        <div class="scope-list">
          <div v-for="s in scopes" :key="s.key" class="scope-item">
            <el-tag type="success">{{ s.label }}</el-tag>
            <span class="scope-desc">{{ s.desc }}</span>
          </div>
        </div>
        <div class="mt24 actions">
          <el-button @click="deny">拒绝</el-button>
          <el-button type="primary" :loading="submitting" @click="submitConsent">
            同意授权
          </el-button>
        </div>
      </div>

      <div v-else class="center">
        <el-result icon="warning" title="不支持的交互类型" :sub-title="details?.prompt?.name" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios, { InteractionDetails } from '../api';

const route = useRoute();
const uid = route.params.uid as string;

const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const details = ref<InteractionDetails | null>(null);

const loginForm = ref({ username: '', password: '', remember: false });

const SCOPE_MAP: Record<string, { label: string; desc: string }> = {
  openid: { label: '身份标识', desc: '获取你的唯一用户 ID' },
  profile: { label: '基本资料', desc: '获取昵称、头像等基础资料' },
  email: { label: '邮箱', desc: '获取你的邮箱地址' },
  phone: { label: '手机号', desc: '获取你的手机号' },
  offline_access: { label: '离线访问', desc: '在你离线时代表你刷新数据' },
};

const scopes = computed(() => {
  const scopeStr = details.value?.params?.scope || 'openid';
  return scopeStr
    .split(' ')
    .filter((s) => s !== 'offline_access')
    .map((s) => ({ key: s, ...(SCOPE_MAP[s] || { label: s, desc: '' }) }));
});

async function loadDetails() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await axios.get<InteractionDetails>(`/interaction/${uid}/details`);
    details.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || '无法获取交互信息';
  } finally {
    loading.value = false;
  }
}

function reload() {
  loadDetails();
}

async function submitLogin() {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  submitting.value = true;
  try {
    const { data } = await axios.post<{ redirectTo: string }>(`/interaction/${uid}/login`, {
      username: loginForm.value.username,
      password: loginForm.value.password,
      remember: loginForm.value.remember,
    });
    window.location.href = data.redirectTo;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '登录失败');
    submitting.value = false;
  }
}

async function submitConsent() {
  submitting.value = true;
  try {
    const { data } = await axios.post<{ redirectTo: string }>(`/interaction/${uid}/confirm`);
    window.location.href = data.redirectTo;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '授权失败');
    submitting.value = false;
  }
}

async function deny() {
  try {
    await ElMessageBox.confirm('拒绝后将返回第三方应用且不授予任何权限，确认拒绝？', '提示', {
      type: 'warning',
    });
    // 拒绝授权：回到客户端，携带 access_denied
    const redirectUri = details.value?.params?.redirect_uri;
    const state = details.value?.params?.state;
    if (redirectUri) {
      const sep = redirectUri.includes('?') ? '&' : '?';
      const statePart = state ? `&state=${encodeURIComponent(state)}` : '';
      window.location.href = `${redirectUri}${sep}error=access_denied&error_description=${encodeURIComponent(
        '用户拒绝授权',
      )}${statePart}`;
    } else {
      ElMessage.info('已拒绝');
    }
  } catch {
    /* 用户取消 */
  }
}

onMounted(loadDetails);
</script>

<style scoped>
.interaction-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eaf2ff 0%, #f3f8ff 100%);
  padding: 24px;
}
.box-card {
  width: 420px;
  max-width: 100%;
}
.card-header {
  font-weight: 600;
}
.brand {
  font-size: 16px;
}
.center {
  text-align: center;
}
.mb16 {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
}
.mt24 {
  margin-top: 24px;
}
.full-btn {
  width: 100%;
}
.scope-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.scope-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.scope-desc {
  color: #666;
  font-size: 13px;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
