<template>
  <div>
    <div class="toolbar">
      <el-radio-group v-model="statusFilter" @change="loadDevelopers">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="active">已通过</el-radio-button>
        <el-radio-button value="suspended">已停用</el-radio-button>
      </el-radio-group>
      <el-button type="primary" plain @click="loadDevelopers">刷新</el-button>
      <el-badge v-if="pendingCount > 0" :value="pendingCount" class="pending-badge">
        <span class="pending-text">个待审核开发者</span>
      </el-badge>
    </div>

    <el-table :data="developers" v-loading="loading" stripe>
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="company" label="公司/团队" min-width="140" />
      <el-table-column prop="contact" label="联系方式" min-width="120" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tooltip :content="row.reject_reason" :disabled="!row.reject_reason" placement="top">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="160">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="最近登录" width="160">
        <template #default="{ row }">{{ row.last_login_at ? fmtTime(row.last_login_at) : '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="success" @click="review(row, 'active')">通过</el-button>
            <el-button size="small" type="danger" @click="review(row, 'suspended')">拒绝</el-button>
          </template>
          <template v-else-if="row.status === 'active'">
            <el-button size="small" type="warning" @click="review(row, 'suspended')">停用</el-button>
          </template>
          <template v-else>
            <el-button size="small" type="success" @click="review(row, 'active')">恢复</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <!-- 拒绝/停用理由 -->
    <el-dialog v-model="rejectVisible" title="填写理由" width="440px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        placeholder="请填写拒绝/停用理由（开发者门户可见）"
      />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="reviewing" @click="submitReject">确认</el-button>
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
  status: 'pending' | 'active' | 'suspended';
  reject_reason: string;
  last_login_at: string | null;
  created_at: string;
}

const loading = ref(false);
const developers = ref<DeveloperRow[]>([]);
const statusFilter = ref('');
const rejectVisible = ref(false);
const rejectReason = ref('');
const reviewing = ref(false);
const rejectTarget = ref<DeveloperRow | null>(null);

const pendingCount = computed(() => developers.value.filter((d) => d.status === 'pending').length);

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

function statusTag(status: string) {
  return status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'danger';
}

function statusText(status: string) {
  return { active: '已通过', pending: '待审核', suspended: '已停用' }[status] || status;
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function review(row: DeveloperRow, next: 'active' | 'suspended') {
  if (next === 'suspended') {
    rejectReason.value = '';
    rejectTarget.value = row;
    rejectVisible.value = true;
    return;
  }
  try {
    await ElMessageBox.confirm(`确认通过开发者「${row.email}」的注册申请？`, '审核确认', {
      type: 'success',
    });
  } catch {
    return;
  }
  await api.patch(`/api/admin/developers/${row.id}/status`, { status: 'active' });
  ElMessage.success('已通过');
  await loadDevelopers();
}

async function submitReject() {
  if (!rejectTarget.value || !rejectReason.value.trim()) {
    ElMessage.warning('请填写理由');
    return;
  }
  reviewing.value = true;
  try {
    await api.patch(`/api/admin/developers/${rejectTarget.value.id}/status`, {
      status: 'suspended',
      reason: rejectReason.value.trim(),
    });
    rejectVisible.value = false;
    ElMessage.success('已处理');
    await loadDevelopers();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '操作失败');
  } finally {
    reviewing.value = false;
  }
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.pending-badge {
  margin-left: auto;
}
.pending-text {
  font-size: 12px;
  color: #909399;
}
</style>
