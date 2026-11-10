<template>
  <div class="profile-edit-page">
    <div class="page-head">
      <el-button link :icon="ArrowLeft" class="back-btn" @click="$router.push('/profile')">
        返回账号资料
      </el-button>
      <h2 class="page-title">编辑开发者资料</h2>
      <p class="page-desc">公司 / 团队与联系方式将展示给平台管理员，用于开发者资格审核与应用归属核对。</p>
    </div>

    <section class="panel" v-loading="loading">
      <el-alert
        v-if="info?.developer_status === 'rejected'"
        class="mb16"
        type="error"
        show-icon
        :closable="false"
        :title="info?.developer_reject_reason || '上次申请未通过，请更新资料后重新提交'"
      />
      <el-alert
        v-else-if="info?.developer_status === 'pending'"
        class="mb16"
        type="warning"
        show-icon
        :closable="false"
        title="资格正在审核中，修改资料不会中断审核流程"
      />
      <el-alert
        v-else-if="info?.developer_status === 'approved'"
        class="mb16"
        type="success"
        show-icon
        :closable="false"
        title="你已通过开发者认证，修改资料不会撤销认证"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="开发者类型" required>
          <el-radio-group v-model="form.developer_type">
            <el-radio value="personal">个人开发者</el-radio>
            <el-radio value="enterprise">企业开发者</el-radio>
          </el-radio-group>
          <div v-if="form.developer_type === 'enterprise'" class="type-hint">
            企业开发者创建应用时需填写 ICP 备案号，请提供方（公司 / 团队）填写真实全称。
          </div>
        </el-form-item>
        <el-form-item label="公司 / 团队" prop="company">
          <el-input v-model="form.company" maxlength="128" placeholder="请填写公司或团队全称" />
        </el-form-item>
        <el-form-item label="联系方式" prop="contact">
          <el-input v-model="form.contact" maxlength="64" placeholder="手机 / 邮箱 / 即时通讯账号" />
        </el-form-item>
      </el-form>

      <el-alert type="info" :closable="false" :title="hintText" />

      <div class="form-actions">
        <el-button @click="$router.push('/profile')">取消</el-button>
        <el-button v-if="canApply" :loading="saving" @click="save(false)">仅保存资料</el-button>
        <el-button type="primary" :loading="saving" :disabled="suspended" @click="save(true)">
          {{ primaryText }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import {
  DeveloperInfo,
  devApplyDeveloper,
  devFetchMe,
  devUpdateProfile,
  extractDevError,
  getCurrentDeveloper,
} from '../../api/dev';

const router = useRouter();
const info = ref<DeveloperInfo | null>(getCurrentDeveloper());
const formRef = ref<FormInstance>();
const form = ref({ company: '', contact: '', developer_type: 'personal' as 'personal' | 'enterprise' });
const saving = ref(false);
const loading = ref(true);

const rules: FormRules = {
  company: [
    { required: true, message: '请填写公司 / 团队名称', trigger: 'blur' },
    { min: 2, message: '至少 2 个字符', trigger: 'blur' },
  ],
  contact: [
    { required: true, message: '请填写联系方式', trigger: 'blur' },
    { min: 2, message: '至少 2 个字符', trigger: 'blur' },
  ],
};

onMounted(async () => {
  const fresh = await devFetchMe();
  if (fresh) info.value = fresh;
  fillForm();
  loading.value = false;
});

function fillForm() {
  form.value = {
    company: info.value?.company || '',
    contact: info.value?.contact || '',
    developer_type: info.value?.developer_type || 'personal',
  };
}

const suspended = computed(() => info.value?.status === 'suspended');
const canApply = computed(
  () =>
    !suspended.value &&
    (info.value?.developer_status === 'none' || info.value?.developer_status === 'rejected'),
);
const primaryText = computed(() => {
  if (suspended.value) return '账号已停用';
  if (canApply.value) return '保存并提交审核';
  if (info.value?.developer_status === 'pending') return '保存修改';
  return '保存资料';
});
const hintText = computed(() => {
  if (canApply.value) {
    return '提交审核后由管理员审批，通过后即可创建应用；也可以先「仅保存资料」，稍后再提交。';
  }
  if (info.value?.developer_status === 'pending') {
    return '审核期间可以更新资料，资格状态保持「审核中」不变。';
  }
  if (info.value?.developer_status === 'approved') {
    return '已认证开发者可直接修改资料，资格状态保持「已认证」不变。';
  }
  return '资料保存后仅自己与管理员可见，不会自动提交资格审核。';
});

async function save(submit: boolean) {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const updated =
      submit && canApply.value
        ? await devApplyDeveloper(form.value.company.trim(), form.value.contact.trim(), form.value.developer_type)
        : await devUpdateProfile(form.value.company.trim(), form.value.contact.trim(), form.value.developer_type);
    info.value = updated;
    ElMessage.success(submit && canApply.value ? '资料已提交，等待管理员审核' : '资料已保存');
    router.push('/profile');
  } catch (e) {
    ElMessage.error(extractDevError(e, '保存失败，请稍后重试'));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.profile-edit-page {
  max-width: 720px;
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
.mb16 {
  margin-bottom: 16px;
}
.type-hint {
  width: 100%;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #b06a00;
  background: #fff7e6;
  border: 1px solid #ffe2b8;
  border-radius: 8px;
  padding: 8px 10px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #eef2f7;
}
</style>
