<template>
  <ConsolePage
    eyebrow="QUALIFICATION REVIEW"
    title="开发者资格审核"
    desc="审核门户用户提交的开发者资料，通过后该用户才能创建接入应用。"
  >
    <template #actions>
      <el-button :icon="Refresh" @click="loadDevelopers">刷新列表</el-button>
      <el-button type="primary" @click="showPending">查看待审核（{{ pendingCount }}）</el-button>
    </template>

    <el-alert
      v-if="pendingCount > 0"
      class="review-alert"
      type="warning"
      show-icon
      :closable="false"
    >
      <template #title>有 {{ pendingCount }} 位用户正在等待开发者资格审核</template>
      审核通过后用户即可创建应用；驳回需填写理由，用户可修改资料后重新提交。
    </el-alert>
    <el-alert v-else class="review-alert" type="success" show-icon :closable="false">
      <template #title>暂无待审核的开发者资格申请</template>
      用户在工作台点击「新建应用」并补充资料后，申请会出现在这里。
    </el-alert>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">门户注册用户</div>
              <div class="stat-value">{{ allDevelopers.length }}</div>
              <div class="stat-sub">全部账号</div>
            </div>
            <div class="stat-icon"><el-icon><User /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">待审核</div>
              <div class="stat-value">{{ pendingCount }}</div>
              <div class="stat-sub">需要尽快处理</div>
            </div>
            <div class="stat-icon warn"><el-icon><Bell /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">已认证开发者</div>
              <div class="stat-value">{{ countBy('approved') }}</div>
              <div class="stat-sub">可创建应用</div>
            </div>
            <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">普通用户</div>
              <div class="stat-value">{{ countBy('none') }}</div>
              <div class="stat-sub">尚未申请资格</div>
            </div>
            <div class="stat-icon"><el-icon><UserFilled /></el-icon></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="box-card">
      <div class="cp-toolbar">
        <el-radio-group v-model="statusFilter">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="pending">待审核</el-radio-button>
          <el-radio-button value="approved">已通过</el-radio-button>
          <el-radio-button value="rejected">已驳回</el-radio-button>
          <el-radio-button value="none">普通用户</el-radio-button>
          <el-radio-button value="suspended">已停用</el-radio-button>
        </el-radio-group>
        <div class="spacer" />
        <el-input
          v-model="keyword"
          placeholder="搜索邮箱 / 公司 / 联系方式"
          clearable
          :prefix-icon="Search"
          style="width: 260px"
        />
      </div>

      <el-table :data="filteredDevelopers" v-loading="loading" stripe>
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="30" class="user-avatar">
                {{ (row.email || '?').slice(0, 1).toUpperCase() }}
              </el-avatar>
              <div>
                <div class="user-email">{{ row.email }}</div>
                <div class="user-id">ID {{ row.id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="company" label="公司 / 团队" min-width="140">
          <template #default="{ row }">{{ row.company || '—' }}</template>
        </el-table-column>
        <el-table-column prop="contact" label="联系方式" min-width="130">
          <template #default="{ row }">{{ row.contact || '—' }}</template>
        </el-table-column>
        <el-table-column label="开发者资格" width="120">
          <template #default="{ row }">
            <el-tooltip
              :content="row.developer_reject_reason"
              :disabled="!row.developer_reject_reason"
              placement="top"
            >
              <el-tag :type="qualificationTag(row.developer_status)" size="small" effect="light">
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
        <el-table-column label="申请时间" width="165">
          <template #default="{ row }">
            {{ row.developer_applied_at ? fmtTime(row.developer_applied_at) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">资料</el-button>
            <template v-if="row.developer_status === 'pending'">
              <el-button size="small" type="success" @click="approve(row)">通过</el-button>
              <el-button size="small" type="danger" @click="openReason(row, 'reject')">驳回</el-button>
            </template>
            <template v-else-if="row.status === 'suspended'">
              <el-button size="small" type="primary" @click="restore(row)">恢复账号</el-button>
            </template>
            <template v-else-if="row.developer_status === 'approved'">
              <el-button size="small" type="warning" plain @click="openReason(row, 'suspend')">
                停用账号
              </el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="没有符合条件的用户" />
        </template>
      </el-table>
    </el-card>

    <!-- 资料详情 -->
    <el-dialog v-model="detailVisible" title="用户资料详情" width="560px">
      <el-descriptions v-if="detailRow" :column="1" border>
        <el-descriptions-item label="邮箱">{{ detailRow.email }}</el-descriptions-item>
        <el-descriptions-item label="公司 / 团队">{{ detailRow.company || '未填写' }}</el-descriptions-item>
        <el-descriptions-item label="联系方式">{{ detailRow.contact || '未填写' }}</el-descriptions-item>
        <el-descriptions-item label="开发者资格">
          {{ qualificationText(detailRow.developer_status) }}
        </el-descriptions-item>
        <el-descriptions-item label="账号状态">
          {{ detailRow.status === 'active' ? '正常' : '停用' }}
        </el-descriptions-item>
        <el-descriptions-item label="提交时间">
          {{ detailRow.developer_applied_at ? fmtTime(detailRow.developer_applied_at) : '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="驳回原因">
          {{ detailRow.developer_reject_reason || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ fmtTime(detailRow.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="最近登录">
          {{ detailRow.last_login_at ? fmtTime(detailRow.last_login_at) : '从未登录' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="detailRow?.developer_status === 'pending'"
          type="primary"
          @click="approve(detailRow!)"
        >
          通过审核
        </el-button>
      </template>
    </el-dialog>

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
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Search, User, UserFilled, Bell, CircleCheck,
} from '@element-plus/icons-vue';
import ConsolePage from '../../components/console/ConsolePage.vue';
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
const allDevelopers = ref<DeveloperRow[]>([]);
const statusFilter = ref('pending');
const keyword = ref('');
const reasonVisible = ref(false);
const detailVisible = ref(false);
const detailRow = ref<DeveloperRow | null>(null);
const reason = ref('');
const submitting = ref(false);
const reasonTarget = ref<DeveloperRow | null>(null);
const reasonMode = ref<'reject' | 'suspend'>('reject');

const filteredDevelopers = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return allDevelopers.value.filter((d) => {
    const matchStatus =
      !statusFilter.value ||
      (statusFilter.value === 'suspended'
        ? d.status === 'suspended'
        : d.developer_status === statusFilter.value);
    const matchKeyword =
      !kw ||
      [d.email, d.company, d.contact].some((v) => (v || '').toLowerCase().includes(kw));
    return matchStatus && matchKeyword;
  });
});
const pendingCount = computed(
  () => allDevelopers.value.filter((d) => d.developer_status === 'pending').length,
);
function countBy(status: string): number {
  return allDevelopers.value.filter((d) => d.developer_status === status).length;
}
const reasonTitle = computed(() =>
  reasonMode.value === 'reject' ? '驳回开发者资格申请' : '停用账号',
);

onMounted(loadDevelopers);

function showPending() {
  statusFilter.value = 'pending';
  keyword.value = '';
}

async function loadDevelopers() {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: DeveloperRow[] }>('/api/admin/developers');
    allDevelopers.value = data.data;
  } finally {
    loading.value = false;
  }
}

/** 审核动作后通知外壳刷新待办角标 */
function notifyPendingChanged() {
  window.dispatchEvent(new Event('console:pending-changed'));
}

function qualificationTag(s: string) {
  return { approved: 'success', pending: 'warning', rejected: 'danger', none: 'info' }[s] || 'info';
}
function qualificationText(s: string) {
  return { approved: '已认证', pending: '待审核', rejected: '已驳回', none: '未申请' }[s] || s;
}
function fmtTime(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function openDetail(row: DeveloperRow) {
  detailRow.value = row;
  detailVisible.value = true;
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
  detailVisible.value = false;
  ElMessage.success('已通过，该用户现在可以创建应用');
  notifyPendingChanged();
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
    notifyPendingChanged();
    await loadDevelopers();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '操作失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.review-alert {
  margin-bottom: 18px;
}
.stat-row {
  margin-bottom: 18px;
}
.stat-row-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-avatar {
  background: linear-gradient(135deg, #0b57d0, #0a3d91);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}
.user-email {
  font-weight: 600;
  color: var(--ink-900);
}
.user-id {
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-300);
}
</style>
