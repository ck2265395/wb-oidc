<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- 左侧品牌区 -->
      <div class="brand-side">
        <img class="brand-logo" src="/moondrop.ico" alt="Moondrop" />
        <h2 class="brand-title">{{ t('developer.nav.brand') }}</h2>
        <p class="brand-desc">{{ t('developer.login.brandDesc') }}</p>
        <ul class="brand-points">
          <li>{{ t('developer.login.point1') }}</li>
          <li>{{ t('developer.login.point2') }}</li>
          <li>{{ t('developer.login.point3') }}</li>
          <li>{{ t('developer.login.point4') }}</li>
        </ul>
        <div class="brand-deco">
          <span class="deco-badge">authorization_code</span>
          <span class="deco-badge">PKCE · S256</span>
          <span class="deco-badge">RS256</span>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="form-side">
        <div class="form-heading">
          <h1 class="form-title">{{ t('developer.login.formTitle') }}</h1>
          <p class="form-subtitle">{{ t('developer.login.formSubtitle') }}</p>
        </div>
        <el-tabs v-model="tab" stretch>
          <el-tab-pane :label="t('developer.login.tabLogin')" name="login">
            <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top" size="large">
              <el-form-item :label="t('developer.common.email')" prop="email">
                <el-input v-model="loginForm.email" placeholder="you@company.com" @keyup.enter="submitLogin" />
              </el-form-item>
              <el-form-item :label="t('developer.common.password')" prop="password">
                <el-input v-model="loginForm.password" type="password" show-password :placeholder="t('developer.common.password')" @keyup.enter="submitLogin" />
              </el-form-item>
              <el-button type="primary" class="block" size="large" :loading="submitting" @click="submitLogin">
                {{ t('developer.login.submitLogin') }}
              </el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane :label="t('developer.login.tabRegister')" name="register">
            <el-form ref="regFormRef" :model="regForm" :rules="regRules" label-position="top" size="large">
              <el-form-item :label="t('developer.common.email')" prop="email">
                <el-input v-model="regForm.email" placeholder="you@company.com" />
              </el-form-item>
              <el-form-item :label="t('developer.common.password')" prop="password">
                <el-input v-model="regForm.password" type="password" show-password :placeholder="t('developer.login.passwordRegHint')" />
              </el-form-item>
              <el-button type="primary" class="block" size="large" :loading="submitting" @click="submitRegister">
                {{ t('developer.login.submitRegister') }}
              </el-button>
              <el-alert
                class="reg-tip"
                type="info"
                :closable="false"
                :title="t('developer.login.regTip')"
              />
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <el-divider />
        <div class="foot">
          <span>{{ t('developer.login.adminHint') }}</span>
          <el-link type="primary" @click="$router.push('/console')">{{ t('developer.login.goConsole') }}</el-link>
        </div>
      </div>
    </div>

    <!-- 注册成功提示 -->
    <el-dialog v-model="regOkVisible" :title="t('developer.login.regSuccessTitle')" width="420px">
      <el-alert type="success" :closable="false" :title="regOkMessage" />
      <template #footer>
        <el-button type="primary" @click="regOkVisible = false">{{ t('developer.common.gotIt') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import type { FormInstance, FormRules } from 'element-plus';
import { devLogin, devRegister, extractDevError, getCurrentDeveloper } from '../../api/dev';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const tab = ref<'login' | 'register'>(
  route.query.tab === 'register' ? 'register' : 'login',
);
const submitting = ref(false);

const loginFormRef = ref<FormInstance>();
const loginForm = ref({ email: '', password: '' });
const loginRules = computed<FormRules>(() => ({
  email: [
    { required: true, message: t('developer.login.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('developer.login.emailInvalid'), trigger: 'blur' },
  ],
  password: [{ required: true, message: t('developer.login.passwordRequired'), trigger: 'blur' }],
}));

const regFormRef = ref<FormInstance>();
const regForm = ref({ email: '', password: '' });
const regRules = computed<FormRules>(() => ({
  email: [
    { required: true, message: t('developer.login.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('developer.login.emailInvalid'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('developer.login.passwordRequired'), trigger: 'blur' },
    { min: 10, max: 128, message: t('developer.login.passwordLength'), trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: t('developer.login.passwordPattern'), trigger: 'blur' },
  ],
}));

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
      ElMessage.warning(t('developer.login.inactiveWarning'));
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    router.replace(redirect || '/apps');
  } catch (e) {
    ElMessage.error(extractDevError(e, t('developer.login.loginFailed')));
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
    });
    regOkMessage.value = message || t('developer.login.regSuccessDefault');
    regOkVisible.value = true;
    loginForm.value.email = regForm.value.email;
    regFormRef.value.resetFields();
    tab.value = 'login';
  } catch (e) {
    ElMessage.error(extractDevError(e, t('developer.login.registerFailed')));
  } finally {
    submitting.value = false;
  }
}

// 已登录直接进工作台
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
.form-heading {
  margin-bottom: 18px;
}
.form-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 800;
  color: #0b1220;
}
.form-subtitle {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
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
