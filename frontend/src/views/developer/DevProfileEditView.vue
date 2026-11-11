<template>
  <div class="profile-edit-page">
    <div class="page-head">
      <el-button link :icon="ArrowLeft" class="back-btn" @click="router.push(backTarget)">
        {{ t('developer.profile.backTo', { target: backLabel }) }}
      </el-button>
      <h2 class="page-title">{{ t('developer.common.editProfile') }}</h2>
      <p class="page-desc">{{ t('developer.profile.editDesc') }}</p>
    </div>

    <section class="panel" v-loading="loading">
      <el-alert
        v-if="info?.developer_status === 'rejected'"
        class="mb16"
        type="error"
        show-icon
        :closable="false"
        :title="info?.developer_reject_reason || t('developer.profile.resubmitHint')"
      />
      <el-alert
        v-else-if="info?.developer_status === 'pending'"
        class="mb16"
        type="warning"
        show-icon
        :closable="false"
        :title="t('developer.profile.pendingNotice')"
      />
      <el-alert
        v-else-if="info?.developer_status === 'approved'"
        class="mb16"
        type="success"
        show-icon
        :closable="false"
        :title="t('developer.profile.approvedNotice')"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item :label="t('developer.profile.fieldType')" required>
          <el-radio-group v-model="form.developer_type">
            <el-radio value="personal">{{ t('developer.profile.typePersonal') }}</el-radio>
            <el-radio value="enterprise">{{ t('developer.profile.typeEnterprise') }}</el-radio>
          </el-radio-group>
          <div v-if="form.developer_type === 'enterprise'" class="type-hint">
            {{ t('developer.profile.enterpriseHint') }}
          </div>
        </el-form-item>
        <el-form-item :label="t('developer.common.company')" prop="company">
          <el-input v-model="form.company" maxlength="128" :placeholder="t('developer.profile.companyPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('developer.common.contact')" prop="contact">
          <el-input v-model="form.contact" maxlength="64" :placeholder="t('developer.profile.contactPlaceholder')" />
        </el-form-item>
      </el-form>

      <el-alert type="info" :closable="false" :title="hintText" />

      <div class="form-actions">
        <el-button @click="router.push(backTarget)">{{ t('developer.common.cancel') }}</el-button>
        <el-button v-if="canApply" :loading="saving" @click="save(false)">{{ t('developer.profile.saveOnly') }}</el-button>
        <el-button type="primary" :loading="saving" :disabled="suspended" @click="save(true)">
          {{ primaryText }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
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

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const info = ref<DeveloperInfo | null>(getCurrentDeveloper());
const formRef = ref<FormInstance>();
const form = ref({ company: '', contact: '', developer_type: 'personal' as 'personal' | 'enterprise' });
const saving = ref(false);
const loading = ref(true);

/**
 * 保存 / 取消 / 返回的去向：从哪进来就回哪去。
 * 来源页通过 ?redirect= 传入，只接受站内绝对路径，避免被拿来跳外链。
 */
const backTarget = computed(() => {
  const raw = route.query.redirect;
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (typeof val === 'string' && val.startsWith('/') && !val.startsWith('//')) {
    // 不允许跳回资料编辑页自身，避免出现死循环
    if (!val.startsWith('/profile/edit')) return val;
  }
  return '/profile';
});
const backLabel = computed(() => {
  const target = backTarget.value;
  if (target.startsWith('/apps')) return t('developer.nav.workspace');
  if (target.startsWith('/profile')) return t('developer.nav.accountProfile');
  return t('developer.profile.backPrevious');
});

const rules = computed<FormRules>(() => ({
  company: [
    { required: true, message: t('developer.profile.companyRequired'), trigger: 'blur' },
    { min: 2, message: t('developer.profile.minChars'), trigger: 'blur' },
  ],
  contact: [
    { required: true, message: t('developer.profile.contactRequired'), trigger: 'blur' },
    { min: 2, message: t('developer.profile.minChars'), trigger: 'blur' },
  ],
}));

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
  if (suspended.value) return t('developer.common.suspended');
  if (canApply.value) return t('developer.profile.saveAndSubmit');
  if (info.value?.developer_status === 'pending') return t('developer.common.saveChanges');
  return t('developer.profile.saveProfile');
});
const hintText = computed(() => {
  if (canApply.value) {
    return t('developer.profile.hintCanApply');
  }
  if (info.value?.developer_status === 'pending') {
    return t('developer.profile.hintPending');
  }
  if (info.value?.developer_status === 'approved') {
    return t('developer.profile.hintApproved');
  }
  return t('developer.profile.hintDefault');
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
    ElMessage.success(
      submit && canApply.value
        ? t('developer.profile.submitted')
        : t('developer.profile.saved'),
    );
    router.push(backTarget.value);
  } catch (e) {
    ElMessage.error(extractDevError(e, t('developer.profile.saveFailed')));
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
