<template>
  <ConsolePage
    eyebrow="ADMINISTRATORS"
    :title="t('console.admins.title')"
    :desc="t('console.admins.desc')"
  >
    <template #actions>
      <el-button :icon="Refresh" @click="loadAdmins">{{ t('console.common.refresh') }}</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">{{ t('console.admins.createNew') }}</el-button>
    </template>

    <el-card shadow="never" class="box-card">
    <el-table :data="admins" v-loading="loading" stripe>
      <el-table-column prop="username" :label="t('console.admins.colUsername')" min-width="120" />
      <el-table-column prop="display_name" :label="t('console.admins.colDisplayName')" min-width="120" />
      <el-table-column :label="t('console.admins.colRole')" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super_admin' ? 'danger' : 'info'" size="small">
            {{ row.role === 'super_admin' ? t('console.admins.roleSuper') : t('console.admins.roleOperator') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('console.common.status')" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? t('console.common.enable') : t('console.common.disable') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('console.admins.colLastLogin')" min-width="160">
        <template #default="{ row }">
          {{ row.last_login_at ? formatTime(row.last_login_at) : t('console.common.neverLogin') }}
        </template>
      </el-table-column>
      <el-table-column :label="t('console.common.actions')" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="openEdit(row)">{{ t('console.common.edit') }}</el-button>
          <el-button size="small" type="warning" link @click="openReset(row)">{{ t('console.admins.resetPassword') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    </el-card>

    <!-- 新建管理员 -->
    <el-dialog v-model="createVisible" :title="t('console.admins.createNew')" width="440px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item :label="t('console.admins.colUsername')" prop="username">
          <el-input v-model="createForm.username" :placeholder="t('console.admins.usernameRule')" />
        </el-form-item>
        <el-form-item :label="t('console.admins.colDisplayName')">
          <el-input v-model="createForm.display_name" :placeholder="t('console.admins.displayNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('console.admins.colRole')" prop="role">
          <el-radio-group v-model="createForm.role">
            <el-radio value="operator">{{ t('console.admins.roleOperatorDesc') }}</el-radio>
            <el-radio value="super_admin">{{ t('console.admins.roleSuperDesc') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('console.admins.labelInitPassword')" prop="password">
          <el-input
            v-model="createForm.password"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="t('console.common.passwordRule')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">{{ t('console.common.create') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑管理员 -->
    <el-dialog v-model="editVisible" :title="t('console.admins.editTitle')" width="440px">
      <el-form label-position="top">
        <el-form-item :label="t('console.admins.colUsername')">
          <el-input :model-value="editingRow?.username" disabled />
        </el-form-item>
        <el-form-item :label="t('console.admins.colDisplayName')">
          <el-input v-model="editForm.display_name" />
        </el-form-item>
        <el-form-item :label="t('console.admins.colRole')">
          <el-radio-group v-model="editForm.role">
            <el-radio value="operator">{{ t('console.admins.roleOperator') }}</el-radio>
            <el-radio value="super_admin">{{ t('console.admins.roleSuper') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('console.admins.labelEnabled')">
          <el-switch v-model="editForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="primary" :loading="editing" @click="submitEdit">{{ t('console.common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetVisible" :title="t('console.admins.resetPassword')" width="440px">
      <el-form label-position="top">
        <el-form-item :label="t('console.admins.labelTargetAccount')">
          <el-input :model-value="resetRow?.username" disabled />
        </el-form-item>
        <el-form-item :label="t('console.admins.labelNewPassword')">
          <el-input v-model="resetForm.password" type="password" show-password />
          <div class="field-hint">{{ t('console.admins.passwordHint') }}</div>
        </el-form-item>
        <el-button size="small" @click="genPassword">{{ t('console.admins.genPassword') }}</el-button>
      </el-form>
      <el-alert
        v-if="resetDone"
        class="mt16"
        type="success"
        :closable="false"
        :title="t('console.admins.resetDoneAlert', { password: resetForm.password })"
      />
      <template #footer>
        <el-button @click="resetVisible = false">{{ t('console.common.close') }}</el-button>
        <el-button type="primary" :loading="resetting" @click="submitReset">{{ t('console.admins.confirmReset') }}</el-button>
      </template>
    </el-dialog>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { Refresh, Plus } from '@element-plus/icons-vue';
import ConsolePage from '../../components/console/ConsolePage.vue';
import {
  AdminInfo,
  createAdmin,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
} from '../../api';

const { t } = useI18n();
const loading = ref(false);
const admins = ref<AdminInfo[]>([]);

const createVisible = ref(false);
const creating = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = ref({ username: '', display_name: '', role: 'operator', password: '' });
const createRules: FormRules = {
  username: [
    { required: true, message: t('console.admins.usernameRequired'), trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_.-]{3,32}$/,
      message: t('console.admins.usernameRule'),
      trigger: 'blur',
    },
  ],
  role: [{ required: true, message: t('console.admins.roleRequired'), trigger: 'change' }],
  password: [
    { required: true, message: t('console.admins.passwordRequired'), trigger: 'blur' },
    { min: 10, message: t('console.admins.passwordMinLength'), trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: t('console.common.passwordAlphaNum'), trigger: 'blur' },
  ],
};

const editVisible = ref(false);
const editing = ref(false);
const editingRow = ref<AdminInfo | null>(null);
const editForm = ref({ display_name: '', role: 'operator', enabled: true });

const resetVisible = ref(false);
const resetting = ref(false);
const resetDone = ref(false);
const resetRow = ref<AdminInfo | null>(null);
const resetForm = ref({ password: '' });

onMounted(loadAdmins);

async function loadAdmins() {
  loading.value = true;
  try {
    admins.value = await listAdmins();
  } catch (e: any) {
    if (e?.response?.status === 403) {
      ElMessage.warning(t('console.admins.superAdminRequired'));
    }
  } finally {
    loading.value = false;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function openCreate() {
  createForm.value = { username: '', display_name: '', role: 'operator', password: '' };
  createVisible.value = true;
}

async function submitCreate() {
  if (!createFormRef.value) return;
  const valid = await createFormRef.value.validate().catch(() => false);
  if (!valid) return;
  creating.value = true;
  try {
    await createAdmin({
      username: createForm.value.username,
      password: createForm.value.password,
      display_name: createForm.value.display_name || undefined,
      role: createForm.value.role as 'super_admin' | 'operator',
    });
    createVisible.value = false;
    ElMessage.success(t('console.admins.createdMsg'));
    await loadAdmins();
  } catch (e: any) {
    ElMessage.error(extractError(e, t('console.admins.createFailed')));
  } finally {
    creating.value = false;
  }
}

function openEdit(row: AdminInfo) {
  editingRow.value = row;
  editForm.value = {
    display_name: row.display_name,
    role: row.role,
    enabled: row.enabled,
  };
  editVisible.value = true;
}

async function submitEdit() {
  if (!editingRow.value) return;
  editing.value = true;
  try {
    await updateAdmin(editingRow.value.id, editForm.value);
    editVisible.value = false;
    ElMessage.success(t('console.common.saved'));
    await loadAdmins();
  } catch (e: any) {
    ElMessage.error(extractError(e, t('console.admins.saveFailed')));
  } finally {
    editing.value = false;
  }
}

function openReset(row: AdminInfo) {
  resetRow.value = row;
  resetForm.value = { password: '' };
  resetDone.value = false;
  resetVisible.value = true;
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let pwd = '';
  bytes.forEach((b) => (pwd += chars[b % chars.length]));
  // 保证含字母和数字
  pwd = pwd.slice(0, 12) + '7a';
  resetForm.value.password = pwd;
}

async function submitReset() {
  if (!resetRow.value) return;
  if (resetForm.value.password.length < 10 || !/^(?=.*[a-zA-Z])(?=.*\d)/.test(resetForm.value.password)) {
    ElMessage.error(t('console.admins.passwordInvalid'));
    return;
  }
  resetting.value = true;
  try {
    await resetAdminPassword(resetRow.value.id, resetForm.value.password);
    resetDone.value = true;
    ElMessage.success(t('console.admins.resetDoneMsg'));
  } catch (e: any) {
    ElMessage.error(extractError(e, t('console.admins.resetFailed')));
  } finally {
    resetting.value = false;
  }
}

function extractError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  return Array.isArray(msg) ? msg[0] : msg || fallback;
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
}
.field-hint {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
</style>
