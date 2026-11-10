<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="brand">
        <div class="logo">🔐</div>
        <h2>Moondrop 管理后台</h2>
        <p class="sub">使用管理员账号登录，管理第三方接入应用</p>
      </div>

      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input
            v-model="form.username"
            size="large"
            placeholder="管理员用户名"
            autocomplete="username"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            size="large"
            show-password
            placeholder="密码"
            autocomplete="current-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb16" />
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="submit">
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '../api';

const router = useRouter();
const route = useRoute();
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const error = ref('');

async function submit() {
  if (loading.value) return;
  error.value = '';
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码';
    return;
  }
  loading.value = true;
  try {
    const admin = await login(form.username.trim(), form.password);
    ElMessage.success(`欢迎，${admin.display_name || admin.username}`);
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
          : msg || '用户名或密码不正确'
        : status === 429
          ? '尝试过于频繁，请稍后再试'
          : '登录失败，请检查网络或后端服务';
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
  background: linear-gradient(135deg, #eaf2ff 0%, #f8fafc 100%);
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
  color: #909399;
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
