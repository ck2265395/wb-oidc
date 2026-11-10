<template>
  <el-dialog v-model="visible" title="编辑开发者资料" width="520px" @closed="clearValidate">
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

    <p class="lead">
      公司 / 团队与联系方式将展示给平台管理员，用于开发者资格审核与应用归属核对。
    </p>

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
        <el-input
          v-model="form.company"
          maxlength="128"
          placeholder="请填写公司或团队全称"
        />
      </el-form-item>
      <el-form-item label="联系方式" prop="contact">
        <el-input
          v-model="form.contact"
          maxlength="64"
          placeholder="手机 / 邮箱 / 即时通讯账号"
        />
      </el-form-item>
    </el-form>

    <el-alert type="info" :closable="false" :title="hintText" />

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button v-if="canApply" :loading="saving" @click="save(false)">仅保存资料</el-button>
      <el-button type="primary" :loading="saving" :disabled="suspended" @click="save(true)">
        {{ primaryText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  DeveloperInfo,
  devApplyDeveloper,
  devUpdateProfile,
  extractDevError,
} from '../../api/dev';

const props = defineProps<{
  modelValue: boolean;
  info: DeveloperInfo | null;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [info: DeveloperInfo];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const formRef = ref<FormInstance>();
const form = ref({ company: '', contact: '', developer_type: 'personal' as const });
const saving = ref(false);
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

const suspended = computed(() => props.info?.status === 'suspended');
const canApply = computed(
  () =>
    !suspended.value &&
    (props.info?.developer_status === 'none' || props.info?.developer_status === 'rejected'),
);
const primaryText = computed(() => {
  if (suspended.value) return '账号已停用';
  if (canApply.value) return '保存并提交审核';
  if (props.info?.developer_status === 'pending') return '保存修改';
  if (props.info?.developer_status === 'approved') return '保存资料';
  return '保存资料';
});
const hintText = computed(() => {
  if (canApply.value) {
    return '提交审核后由管理员审批，通过后即可创建应用；也可以先「仅保存资料」，稍后再提交。';
  }
  if (props.info?.developer_status === 'pending') {
    return '审核期间可以更新资料，资格状态保持「审核中」不变。';
  }
  if (props.info?.developer_status === 'approved') {
    return '已认证开发者可直接修改资料，资格状态保持「已认证」不变。';
  }
  return '资料保存后仅自己与管理员可见，不会自动提交资格审核。';
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    form.value = {
      company: props.info?.company || '',
      contact: props.info?.contact || '',
      developer_type: props.info?.developer_type || 'personal',
    };
    formRef.value?.clearValidate();
  },
);

function clearValidate() {
  formRef.value?.clearValidate();
}

/** submit=true 时，普通用户 / 被驳回用户额外触发资格申请 */
async function save(submit: boolean) {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const updated =
      submit && canApply.value
        ? await devApplyDeveloper(
            form.value.company.trim(),
            form.value.contact.trim(),
            form.value.developer_type,
          )
        : await devUpdateProfile(
            form.value.company.trim(),
            form.value.contact.trim(),
            form.value.developer_type,
          );
    emit('saved', updated);
    ElMessage.success(
      submit && canApply.value ? '资料已提交，等待管理员审核' : '资料已保存',
    );
    visible.value = false;
  } catch (e) {
    ElMessage.error(extractDevError(e, '保存失败，请稍后重试'));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.lead {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: #6b7280;
}
.type-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #b06a00;
  background: #fff7e6;
  border: 1px solid #ffe2b8;
  border-radius: 8px;
  padding: 8px 10px;
}
.mb16 {
  margin-bottom: 16px;
}
</style>
