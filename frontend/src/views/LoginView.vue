<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="brand">
        <div class="logo">🔐</div>
        <h2>{{ t('common.login.brand') }}</h2>
        <p class="sub">{{ t('common.login.sub') }}</p>
      </div>

      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item :label="t('common.login.username')">
          <el-input
            v-model="form.username"
            size="large"
            :placeholder="t('common.login.usernamePlaceholder')"
            autocomplete="username"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item :label="t('common.login.password')">
          <el-input
            v-model="form.password"
            type="password"
            size="large"
            show-password
            :placeholder="t('common.login.passwordPlaceholder')"
            autocomplete="current-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb16" />
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="submit">
          {{ t('common.login.submit') }}
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { login } from '../api';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const error = ref('');

async function submit() {
  if (loading.value) return;
  error.value = '';
  if (!form.username || !form.password) {
    error.value = t('common.login.enterBoth');
    return;
  }
  loading.value = true;
  try {
    const admin = await login(form.username.trim(), form.password);
    ElMessage.success(t('common.login.welcome', { name: admin.display_name || admin.username }));
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/console';
    // 只允许站内相对路径，防开放重定向
    router.replace(redirect.startsWith('/') ? redirect : '/console');
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message;
    error.value =
      status === 401
        ? Array.isArray(msg)
          ? msg[0]
          : msg || t('common.login.err401')
        : status === 429
          ? t('common.login.err429')
          : t('common.login.errNetwork');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-100) 0%, var(--canvas) 100%);
}
.login-card {
  width: 400px;
  padding: 8px 12px 16px;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(31, 45, 61, 0.08);
}
.brand {
  text-align: center;
  margin-bottom: 20px;
}
.logo {
  font-size: 32px;
  line-height: 1;
}
.brand h2 {
  margin: 10px 0 6px;
  font-size: 20px;
}
.sub {
  margin: 0;
  color: var(--ink-500);
  font-size: 13px;
}
.submit {
  width: 100%;
  margin-top: 4px;
}
.mb16 {
  margin-bottom: 16px;
}
</style>
