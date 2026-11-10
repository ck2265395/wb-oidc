<template>
  <div>
    <div class="toolbar">
      <el-radio-group v-model="statusFilter" @change="loadDevelopers">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
        <el-radio-button value="none">普通用户</el-radio-button>
        <el-radio-button value="suspended">已停用</el-radio-button>
      </el-radio-group>
      <el-button type="primary" plain @click="loadDevelopers">刷新</el-button>
      <el-badge v-if="pendingCount > 0" :value="pendingCount" class="pending-badge">
        <span class="pending-text">个待审核资格申请</span>
      </el-badge>
    </div>

    <el-table :data="developers" v-loading="loading" stripe>
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="company" label="公司/团队" min-width="140">
        <template #default="{ row }">{{ row.company || '—' }}</template>
      </el-table-column>
      <el-table-column prop="contact" label="联系方式" min-width="120">
        <template #default="{ row }">{{ row.contact || '—' }}</template>
      </el-table-column>
      <el-table-column label="开发者资格" width="120">
        <template #default="{ row }">
          <el-tooltip
            :content="row.developer_reject_reason"
            :disabled="!row.developer_reject_reason"
            placement="top"
          >
            <el-tag :type="qualificationTag(row.developer_status)" size="small">
              {{ qualificationText(row.developer_status) }}
            </el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="账号" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small" effect="plain">
            {{ row.status === 'active' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="160">
        <template #default="{ row }">
          {{ row.developer_applied_at ? fmtTime(row.developer_applied_at) : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="160">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="row.developer_status === 'pending'">
            <el-button size="small" type="success" @click="approve(row)">通过</el-button>
            <el-button size="small" type="danger" @click="openReason(row, 'reject')">驳回</el-button>
          </template>
          <template v-else-if="row.status === 'suspended'">
            <el-button size="small" type="primary" @click="restore(row)">恢复账号</el-button>
          </template>
          <template v-else-if="row.developer_status === 'approved'">
            <el-button size="small" type="warning" @click="openReason(row, 'suspend')">停用账号</el-button>
          </template>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 驳回 / 停用理由 -->
    <el-dialog v-model="reasonVisible" :title="reasonTitle" width="440px">
      <el-input
        v-model="reason"
        type="textarea"
        :rows="3"
        placeholder="请填写理由（用户门户可见）"
      />
      <template #footer>
        <el-button @click="reasonVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="submitReason">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../api';

interface DeveloperRow {
  id: number;
  email: string;
  company: string;
  contact: string;
  status: 'active' | 'suspended';
  developer_status: 'none' | 'pending' | 'approved' | 'rejected';
  developer_reject_reason: string;
  developer_applied_at: string | null;
  reject_reason: string;
  last_login_at: string | null;
  created_at: string;
}

const loading = ref(false);
const developers = ref<DeveloperRow[]>([]);
const statusFilter = ref('');
const reasonVisible = ref(false);
const reason = ref('');
const submitting = ref(false);
const reasonTarget = ref<DeveloperRow | null>(null);
const reasonMode = ref<'reject' | 'suspend'>('reject');

const pendingCount = computed(
  () => developers.value.filter((d) => d.developer_status === 'pending').length,
);
const reasonTitle = computed(() =>
  reasonMode.value === 'reject' ? '驳回开发者资格申请' : '停用账号',
);

onMounted(loadDevelopers);

async function loadDevelopers() {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: DeveloperRow[] }>('/api/admin/developers', {
      params: statusFilter.value ? { status: statusFilter.value } : {},
    });
    developers.value = data.data;
  } finally {
    loading.value = false;
  }
}

function qualificationTag(s: string) {
  return (
    { approved: 'success', pending: 'warning', rejected: 'danger', none: 'info' }[s] || 'info'
  );
}

function qualificationText(s: string) {
  return (
    { approved: '已认证', pending: '待审核', rejected: '已驳回', none: '未申请' }[s] || s
  );
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function approve(row: DeveloperRow) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${row.email}」的开发者资格申请？通过后该用户即可创建应用。`,
      '审核确认',
      { type: 'success' },
    );
  } catch {
    return;
  }
  await api.patch(`/api/admin/developers/${row.id}/review`, { action: 'approve' });
  ElMessage.success('已通过');
  await loadDevelopers();
}

async function restore(row: DeveloperRow) {
  try {
    await ElMessageBox.confirm(`确认恢复「${row.email}」的账号？`, '确认', { type: 'info' });
  } catch {
    return;
  }
  await api.patch(`/api/admin/developers/${row.id}/status`, { status: 'active' });
  ElMessage.success('账号已恢复');
  await loadDevelopers();
}

function openReason(row: DeveloperRow, mode: 'reject' | 'suspend') {
  reasonTarget.value = row;
  reasonMode.value = mode;
  reason.value = '';
  reasonVisible.value = true;
}

async function submitReason() {
  if (!reasonTarget.value || !reason.value.trim()) {
    ElMessage.warning('请填写理由');
    return;
  }
  submitting.value = true;
  try {
    if (reasonMode.value === 'reject') {
      await api.patch(`/api/admin/developers/${reasonTarget.value.id}/review`, {
        action: 'reject',
        reason: reason.value.trim(),
      });
    } else {
      await api.patch(`/api/admin/developers/${reasonTarget.value.id}/status`, {
        status: 'suspended',
        reason: reason.value.trim(),
      });
    }
    reasonVisible.value = false;
    ElMessage.success('已处理');
    await loadDevelopers();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '操作失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.pending-badge {
  margin-left: auto;
}
.pending-text {
  font-size: 12px;
  color: #6b7280;
}
.muted {
  color: #9ca3af;
}
</style>
