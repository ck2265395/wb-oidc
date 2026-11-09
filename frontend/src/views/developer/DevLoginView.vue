<template>
  <div class="dev-login-page">
    <el-card class="card" shadow="always">
      <div class="head">
        <div class="logo">🚪 开发者门户</div>
        <div class="sub">接入统一身份认证（OIDC），触达平台存量用户</div>
      </div>

      <el-tabs v-model="tab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="loginForm.email" placeholder="you@company.com" @keyup.enter="submitLogin" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="loginForm.password" type="password" show-password placeholder="密码" @keyup.enter="submitLogin" />
            </el-form-item>
            <el-button type="primary" class="block" :loading="submitting" @click="submitLogin">
              登录
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form ref="regFormRef" :model="regForm" :rules="regRules" label-position="top">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="regForm.email" placeholder="you@company.com" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="regForm.password" type="password" show-password placeholder="至少 10 位，含字母和数字" />
            </el-form-item>
            <el-form-item label="公司 / 团队名称">
              <el-input v-model="regForm.company" placeholder="选填，便于管理员审核" />
            </el-form-item>
            <el-form-item label="联系方式">
              <el-input v-model="regForm.contact" placeholder="选填，手机号或微信号" />
            </el-form-item>
            <el-button type="primary" class="block" :loading="submitting" @click="submitRegister">
              提交注册申请
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <el-divider />
      <div class="foot">
        <span>管理员？</span>
        <el-link type="primary" @click="$router.push('/login')">去管理控制台</el-link>
      </div>
    </el-card>

    <!-- 注册成功提示 -->
    <el-dialog v-model="regOkVisible" title="注册成功" width="420px">
      <el-alert type="success" :closable="false" :title="regOkMessage" />
      <template #footer>
        <el-button type="primary" @click="regOkVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { devLogin, devRegister, extractDevError, getCurrentDeveloper } from '../../api/dev';

const router = useRouter();
const route = useRoute();
const tab = ref<'login' | 'register'>('login');
const submitting = ref(false);

const loginFormRef = ref<FormInstance>();
const loginForm = ref({ email: '', password: '' });
const loginRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const regFormRef = ref<FormInstance>();
const regForm = ref({ email: '', password: '', company: '', contact: '' });
const regRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 10, max: 128, message: '密码长度需 10-128 位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '需同时包含字母和数字', trigger: 'blur' },
  ],
};

const regOkVisible = ref(false);
const regOkMessage = ref('');

async function submitLogin() {
  if (!loginFormRef.value) return;
  const valid = await loginFormRef.value.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const dev = await devLogin(loginForm.value.email, loginForm.value.password);
    if (dev.status !== 'active') {
      ElMessage.warning('账号未通过审核或已停用，功能受限');
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    router.replace(redirect || '/developer');
  } catch (e) {
    ElMessage.error(extractDevError(e, '登录失败，请稍后重试'));
  } finally {
    submitting.value = false;
  }
}

async function submitRegister() {
  if (!regFormRef.value) return;
  const valid = await regFormRef.value.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const message = await devRegister({
      email: regForm.value.email,
      password: regForm.value.password,
      company: regForm.value.company,
      contact: regForm.value.contact,
    });
    regOkMessage.value = message || '注册成功，等待管理员审核';
    regOkVisible.value = true;
    regFormRef.value.resetFields();
    tab.value = 'login';
  } catch (e) {
    ElMessage.error(extractDevError(e, '注册失败，请稍后重试'));
  } finally {
    submitting.value = false;
  }
}

// 已登录直接进门户
if (getCurrentDeveloper()) router.replace('/developer');
</script>

<style scoped>
.dev-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2d3d 0%, #2b4a6f 100%);
}
.card {
  width: 400px;
}
.head {
  text-align: center;
  margin-bottom: 8px;
}
.logo {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.sub {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
.block {
  width: 100%;
  margin-top: 4px;
}
.foot {
  text-align: center;
  font-size: 13px;
  color: #909399;
}
</style>
