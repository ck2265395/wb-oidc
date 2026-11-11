<template>
  <div class="interaction-page">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span class="brand">🔐 {{ t('common.interaction.brand') }}</span>
        </div>
      </template>

      <div v-if="loading" class="center">
        <el-skeleton :rows="4" animated />
      </div>

      <div v-else-if="error" class="center">
        <el-result icon="error" :title="t('common.interaction.errorTitle')" :sub-title="error">
          <template #extra>
            <el-button @click="reload">{{ t('common.interaction.retry') }}</el-button>
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
          :title="t('common.interaction.clientLoginTitle', { name: details.client.client_name })"
          :description="t('common.interaction.clientLoginDesc')"
        />
        <el-form label-position="top" @submit.prevent>
          <el-form-item :label="t('common.interaction.username')">
            <el-input v-model="loginForm.username" :placeholder="t('common.interaction.usernamePlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('common.interaction.password')">
            <el-input
              v-model="loginForm.password"
              type="password"
              show-password
              :placeholder="t('common.interaction.passwordPlaceholder')"
              @keyup.enter="submitLogin"
            />
          </el-form-item>
          <el-checkbox v-model="loginForm.remember">{{ t('common.interaction.remember') }}</el-checkbox>
          <el-button
            type="primary"
            class="full-btn mt16"
            :loading="submitting"
            @click="submitLogin"
          >
            {{ t('common.interaction.submit') }}
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
          :title="t('common.interaction.clientScopeTitle', { name: details.client.client_name })"
        />
        <div class="scope-list">
          <div v-for="s in scopes" :key="s.key" class="scope-item">
            <el-tag type="success">{{ s.label }}</el-tag>
            <span class="scope-desc">{{ s.desc }}</span>
          </div>
        </div>
        <div class="mt24 actions">
          <el-button @click="deny">{{ t('common.interaction.reject') }}</el-button>
          <el-button type="primary" :loading="submitting" @click="submitConsent">
            {{ t('common.interaction.approve') }}
          </el-button>
        </div>
      </div>

      <div v-else class="center">
        <el-result
          icon="warning"
          :title="t('common.interaction.unsupported')"
          :sub-title="details?.prompt?.name"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import axios, { InteractionDetails } from '../api';

const route = useRoute();
const uid = route.params.uid as string;
const { t } = useI18n();

const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const details = ref<InteractionDetails | null>(null);

const loginForm = ref({ username: '', password: '', remember: false });

const SCOPE_KEYS: Record<string, string> = {
  openid: 'openid',
  profile: 'profile',
  email: 'email',
  phone: 'phone',
  offline_access: 'offline_access',
};

const scopes = computed(() => {
  const scopeStr = details.value?.params?.scope || 'openid';
  return scopeStr
    .split(' ')
    .filter((s) => s !== 'offline_access')
    .map((s) => ({
      key: s,
      label: SCOPE_KEYS[s] ? t(`common.interaction.scopes.${s}`) : s,
      desc: SCOPE_KEYS[s] ? t(`common.interaction.scopes.${s}Desc`) : '',
    }));
});

async function loadDetails() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await axios.get<InteractionDetails>(`/interaction/${uid}/details`);
    details.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || t('common.interaction.loadFailed');
  } finally {
    loading.value = false;
  }
}

function reload() {
  loadDetails();
}

async function submitLogin() {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning(t('common.interaction.enterBoth'));
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
    ElMessage.error(e?.response?.data?.message || t('common.interaction.loginFailed'));
    submitting.value = false;
  }
}

async function submitConsent() {
  submitting.value = true;
  try {
    const { data } = await axios.post<{ redirectTo: string }>(`/interaction/${uid}/confirm`);
    window.location.href = data.redirectTo;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t('common.interaction.consentFailed'));
    submitting.value = false;
  }
}

async function deny() {
  try {
    await ElMessageBox.confirm(t('common.interaction.consentConfirm'), t('common.interaction.confirmTitle'), {
      type: 'warning',
    });
    // 拒绝授权：回到客户端，携带 access_denied
    const redirectUri = details.value?.params?.redirect_uri;
    const state = details.value?.params?.state;
    if (redirectUri) {
      const sep = redirectUri.includes('?') ? '&' : '?';
      const statePart = state ? `&state=${encodeURIComponent(state)}` : '';
      window.location.href = `${redirectUri}${sep}error=access_denied&error_description=${encodeURIComponent(
        t('common.interaction.deniedDesc'),
      )}${statePart}`;
    } else {
      ElMessage.info(t('common.interaction.denied'));
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
  background: linear-gradient(135deg, var(--brand-100) 0%, var(--canvas) 100%);
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
  color: var(--ink-500);
  font-size: 13px;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
