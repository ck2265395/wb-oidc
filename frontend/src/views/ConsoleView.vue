<template>
  <div class="console-page">
    <el-container class="layout">
      <el-aside width="210px" class="aside">
        <div class="logo">🛠 WB OIDC 控制台</div>
        <el-menu :default-active="route.path" router class="menu">
          <el-menu-item index="/console/overview">
            <span>📊 概览</span>
          </el-menu-item>
          <el-menu-item index="/console/clients">
            <span>📦 应用管理</span>
          </el-menu-item>
          <el-menu-item index="/console/developers">
            <span>👥 开发者审核</span>
          </el-menu-item>
          <el-menu-item index="/console/admins">
            <span>👤 管理员</span>
          </el-menu-item>
          <el-menu-item index="/console/legacy-users">
            <span>🔍 老库用户</span>
          </el-menu-item>
          <el-menu-item index="/console/audit">
            <span>📝 审计日志</span>
          </el-menu-item>
          <el-menu-item index="/console/sessions">
            <span>🔑 会话管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <el-space :size="12">
            <el-tag v-if="admin" :type="admin.role === 'super_admin' ? 'danger' : 'info'" size="small">
              {{ admin.role === 'super_admin' ? '超级管理员' : '运营' }}
            </el-tag>
            <span class="admin-name">{{ admin?.display_name || admin?.username }}</span>
          </el-space>
          <el-space :size="4">
            <el-button text @click="openPassword">修改密码</el-button>
            <el-button text @click="handleLogout">退出登录</el-button>
          </el-space>
        </el-header>
        <el-main class="main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>

    <!-- 修改管理员密码 -->
    <el-dialog v-model="pwdVisible" title="修改管理员密码" width="440px" @closed="resetPwdForm">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-position="top">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="pwdForm.oldPassword"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="当前登录密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 10 位，含字母和数字"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="pwdForm.confirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="再输入一次新密码"
          />
        </el-form-item>
      </el-form>
      <el-alert
        type="warning"
        :closable="false"
        title="修改成功后所有设备都会退出登录，需要用新密码重新登录。"
      />
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSubmitting" @click="submitPassword">
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { changePassword, fetchMe, getCurrentAdmin, logout, AdminInfo } from '../api';

const router = useRouter();
const route = useRoute();
const admin = ref<AdminInfo | null>(getCurrentAdmin());

onMounted(async () => {
  admin.value = (await fetchMe()) || getCurrentAdmin();
});

async function handleLogout() {
  try {
    await logout();
  } finally {
    ElMessage.success('已退出登录');
    router.replace('/login');
  }
}

// 修改密码
const pwdVisible = ref(false);
const pwdSubmitting = ref(false);
const pwdFormRef = ref<FormInstance>();
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 10, max: 128, message: '密码长度需 10-128 位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '需同时包含字母和数字', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== pwdForm.value.newPassword) callback(new Error('两次输入的密码不一致'));
        else callback();
      },
      trigger: 'blur',
    },
  ],
};

function openPassword() {
  resetPwdForm();
  pwdVisible.value = true;
}

function resetPwdForm() {
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  pwdFormRef.value?.clearValidate();
}

async function submitPassword() {
  if (!pwdFormRef.value) return;
  const valid = await pwdFormRef.value.validate().catch(() => false);
  if (!valid) return;
  pwdSubmitting.value = true;
  try {
    await changePassword(pwdForm.value.oldPassword, pwdForm.value.newPassword);
    pwdVisible.value = false;
    ElMessage.success('密码已修改，请用新密码重新登录');
    setTimeout(() => router.replace('/login'), 800);
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    ElMessage.error(Array.isArray(msg) ? msg[0] : msg || '修改失败，请稍后重试');
  } finally {
    pwdSubmitting.value = false;
  }
}
</script>

<style scoped>
.console-page {
  height: 100%;
  background: #f5f7fa;
}
.layout {
  height: 100vh;
}
.aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
}
.menu {
  border-right: none;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.admin-name {
  color: #606266;
  font-size: 14px;
}
.main {
  overflow: auto;
}
</style>
