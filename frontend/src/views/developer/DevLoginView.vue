<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- 左侧品牌区 -->
      <div class="brand-side">
        <img class="brand-logo" src="/moondrop.ico" alt="Moondrop" />
        <h2 class="brand-title">Moondrop 开放平台</h2>
        <p class="brand-desc">接入统一身份认证，触达全平台存量用户</p>
        <ul class="brand-points">
          <li>✓ 标准 OIDC 协议，主流客户端开箱即用</li>
          <li>✓ 用户免注册，现有账号一键登录</li>
          <li>✓ 回调白名单 + 应用审核双重把关</li>
        </ul>
        <div class="brand-deco">
          <span class="deco-badge">authorization_code</span>
          <span class="deco-badge">PKCE · S256</span>
          <span class="deco-badge">RS256</span>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="form-side">
        <el-tabs v-model="tab" stretch>
          <el-tab-pane label="开发者登录" name="login">
            <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top" size="large">
              <el-form-item label="邮箱" prop="email">
                <el-input v-model="loginForm.email" placeholder="you@company.com" @keyup.enter="submitLogin" />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input v-model="loginForm.password" type="password" show-password placeholder="密码" @keyup.enter="submitLogin" />
              </el-form-item>
              <el-button type="primary" class="block" size="large" :loading="submitting" @click="submitLogin">
                登录开发者中心
              </el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="注册开发者" name="register">
            <el-form ref="regFormRef" :model="regForm" :rules="regRules" label-position="top" size="large">
              <el-form-item label="邮箱" prop="email">
                <el-input v-model="regForm.email" placeholder="you@company.com" />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input v-model="regForm.password" type="password" show-password placeholder="至少 10 位，含字母和数字" />
              </el-form-item>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="公司 / 团队">
                    <el-input v-model="regForm.company" placeholder="选填，便于审核" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="联系方式">
                    <el-input v-model="regForm.contact" placeholder="选填" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-button type="primary" class="block" size="large" :loading="submitting" @click="submitRegister">
                提交注册申请
              </el-button>
              <el-alert
                class="reg-tip"
                type="info"
                :closable="false"
                title="提交后进入人工审核，通过后即可登录并提交应用。"
              />
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <el-divider />
        <div class="foot">
          <span>平台管理员？</span>
          <el-link type="primary" @click="$router.push('/console')">进入管理控制台</el-link>
        </div>
      </div>
    </div>

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
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { devLogin, devRegister, extractDevError, getCurrentDeveloper } from '../../api/dev';

const router = useRouter();
const route = useRoute();
const tab = ref<'login' | 'register'>(
  route.query.tab === 'register' ? 'register' : 'login',
);
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
    router.replace(redirect || '/apps');
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

// 已登录直接进应用管理
onMounted(() => {
  if (getCurrentDeveloper()) router.replace('/apps');
});
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(900px 420px at 15% 0%, rgba(11, 87, 208, 0.12), transparent 60%),
    radial-gradient(900px 420px at 90% 100%, rgba(10, 61, 145, 0.1), transparent 60%),
    #f2f7ff;
}
.auth-card {
  width: 860px;
  max-width: 100%;
  min-height: 560px;
  display: flex;
  border-radius: 20px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 24px 64px rgba(17, 24, 39, 0.12);
}
.brand-side {
  width: 380px;
  flex-shrink: 0;
  padding: 48px 36px;
  background: linear-gradient(160deg, #061a3a 0%, #0a3d91 62%, #0b57d0 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
}
.brand-logo {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: 5px;
  box-sizing: border-box;
  object-fit: contain;
}
.brand-title {
  margin: 28px 0 8px;
  font-size: 24px;
  font-weight: 800;
  color: #fff;
}
.brand-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.6;
}
.brand-points {
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}
.brand-deco {
  margin-top: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.deco-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: rgba(255, 255, 255, 0.88);
}
.form-side {
  flex: 1;
  padding: 40px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.block {
  width: 100%;
  margin-top: 4px;
}
.reg-tip {
  margin-top: 12px;
}
.foot {
  text-align: center;
  font-size: 13px;
  color: #909399;
  display: flex;
  justify-content: center;
  gap: 6px;
  align-items: center;
}
</style>
