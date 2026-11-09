<template>
  <div>
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">+ 新建管理员</el-button>
      <el-button @click="loadAdmins">刷新</el-button>
    </div>

    <el-table :data="admins" v-loading="loading" stripe>
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="display_name" label="显示名" min-width="120" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super_admin' ? 'danger' : 'info'" size="small">
            {{ row.role === 'super_admin' ? '超级管理员' : '运营' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后登录" min-width="160">
        <template #default="{ row }">
          {{ row.last_login_at ? formatTime(row.last_login_at) : '从未登录' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="warning" link @click="openReset(row)">重置密码</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建管理员 -->
    <el-dialog v-model="createVisible" title="新建管理员" width="440px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="3-32 位字母/数字/_.-" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="createForm.display_name" placeholder="默认同用户名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="createForm.role">
            <el-radio value="operator">运营（只能管理应用）</el-radio>
            <el-radio value="super_admin">超级管理员（可管管理员和应用）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input
            v-model="createForm.password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 10 位，含字母和数字"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑管理员 -->
    <el-dialog v-model="editVisible" title="编辑管理员" width="440px">
      <el-form label-position="top">
        <el-form-item label="用户名">
          <el-input :model-value="editingRow?.username" disabled />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="editForm.display_name" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="editForm.role">
            <el-radio value="operator">运营</el-radio>
            <el-radio value="super_admin">超级管理员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="editForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editing" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="440px">
      <el-form label-position="top">
        <el-form-item label="目标账号">
          <el-input :model-value="resetRow?.username" disabled />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="resetForm.password" type="password" show-password />
          <div class="field-hint">至少 10 位，需同时包含字母和数字</div>
        </el-form-item>
        <el-button size="small" @click="genPassword">生成随机密码</el-button>
      </el-form>
      <el-alert
        v-if="resetDone"
        class="mt16"
        type="success"
        :closable="false"
        :title="`新密码已生效（仅本次显示）：${resetForm.password}`"
      />
      <template #footer>
        <el-button @click="resetVisible = false">关闭</el-button>
        <el-button type="primary" :loading="resetting" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  AdminInfo,
  createAdmin,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
} from '../../api';

const loading = ref(false);
const admins = ref<AdminInfo[]>([]);

const createVisible = ref(false);
const creating = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = ref({ username: '', display_name: '', role: 'operator', password: '' });
const createRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_.-]{3,32}$/,
      message: '3-32 位字母/数字/_.-',
      trigger: 'blur',
    },
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 10, message: '至少 10 位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '需同时包含字母和数字', trigger: 'blur' },
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
      ElMessage.warning('需要超级管理员权限');
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
    ElMessage.success('管理员已创建');
    await loadAdmins();
  } catch (e: any) {
    ElMessage.error(extractError(e, '创建失败'));
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
    ElMessage.success('已保存');
    await loadAdmins();
  } catch (e: any) {
    ElMessage.error(extractError(e, '保存失败'));
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
    ElMessage.error('密码需至少 10 位且包含字母和数字');
    return;
  }
  resetting.value = true;
  try {
    await resetAdminPassword(resetRow.value.id, resetForm.value.password);
    resetDone.value = true;
    ElMessage.success('密码已重置，该账号所有会话已下线');
  } catch (e: any) {
    ElMessage.error(extractError(e, '重置失败'));
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
