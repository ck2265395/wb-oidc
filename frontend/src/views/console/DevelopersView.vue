<template>
  <ConsolePage
    eyebrow="QUALIFICATION REVIEW"
    :title="t('console.developers.title')"
    :desc="t('console.developers.desc')"
  >
    <template #actions>
      <el-button :icon="Refresh" @click="loadDevelopers">{{ t('console.developers.refreshList') }}</el-button>
      <el-button type="primary" @click="showPending">{{ t('console.developers.showPending', { n: pendingCount }) }}</el-button>
    </template>

    <el-alert
      v-if="pendingCount > 0"
      class="review-alert"
      type="warning"
      show-icon
      :closable="false"
    >
      <template #title>{{ t('console.developers.pendingAlertTitle', { n: pendingCount }) }}</template>
      {{ t('console.developers.pendingAlertBody') }}
    </el-alert>
    <el-alert v-else class="review-alert" type="success" show-icon :closable="false">
      <template #title>{{ t('console.developers.noPendingTitle') }}</template>
      {{ t('console.developers.noPendingBody') }}
    </el-alert>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">{{ t('console.developers.statUsers') }}</div>
              <div class="stat-value">{{ allDevelopers.length }}</div>
              <div class="stat-sub">{{ t('console.developers.statUsersSub') }}</div>
            </div>
            <div class="stat-icon"><el-icon><User /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">{{ t('console.common.pending') }}</div>
              <div class="stat-value">{{ pendingCount }}</div>
              <div class="stat-sub">{{ t('console.developers.statPendingSub') }}</div>
            </div>
            <div class="stat-icon warn"><el-icon><Bell /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">{{ t('console.developers.statApproved') }}</div>
              <div class="stat-value">{{ countBy('approved') }}</div>
              <div class="stat-sub">{{ t('console.developers.statApprovedSub') }}</div>
            </div>
            <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-row-inner">
            <div>
              <div class="stat-label">{{ t('console.developers.normalUser') }}</div>
              <div class="stat-value">{{ countBy('none') }}</div>
              <div class="stat-sub">{{ t('console.developers.statNormalSub') }}</div>
            </div>
            <div class="stat-icon"><el-icon><UserFilled /></el-icon></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="box-card">
      <div class="cp-toolbar">
        <el-radio-group v-model="statusFilter">
          <el-radio-button value="">{{ t('console.common.all') }}</el-radio-button>
          <el-radio-button value="pending">{{ t('console.common.pending') }}</el-radio-button>
          <el-radio-button value="approved">{{ t('console.common.approved') }}</el-radio-button>
          <el-radio-button value="rejected">{{ t('console.developers.rejected') }}</el-radio-button>
          <el-radio-button value="none">{{ t('console.developers.normalUser') }}</el-radio-button>
          <el-radio-button value="suspended">{{ t('console.developers.suspended') }}</el-radio-button>
        </el-radio-group>
        <div class="spacer" />
        <el-input
          v-model="keyword"
          :placeholder="t('console.developers.searchPlaceholder')"
          clearable
          :prefix-icon="Search"
          style="width: 260px"
        />
      </div>

      <el-table :data="filteredDevelopers" v-loading="loading" stripe>
        <el-table-column :label="t('console.developers.colUser')" min-width="200">
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
        <el-table-column prop="company" :label="t('console.developers.colCompany')" min-width="140">
          <template #default="{ row }">{{ row.company || '—' }}</template>
        </el-table-column>
        <el-table-column prop="contact" :label="t('console.developers.colContact')" min-width="130">
          <template #default="{ row }">{{ row.contact || '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('console.developers.colQualification')" width="120">
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
        <el-table-column :label="t('console.developers.colAccount')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small" effect="plain">
              {{ row.status === 'active' ? t('console.developers.accountActive') : t('console.common.disable') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('console.developers.colAppliedAt')" width="165">
          <template #default="{ row }">
            {{ row.developer_applied_at ? fmtTime(row.developer_applied_at) : '—' }}
          </template>
        </el-table-column>
        <el-table-column :label="t('console.common.actions')" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">{{ t('console.developers.btnProfile') }}</el-button>
            <template v-if="row.developer_status === 'pending'">
              <el-button size="small" type="success" @click="approve(row)">{{ t('console.common.approve') }}</el-button>
              <el-button size="small" type="danger" @click="openReason(row, 'reject')">{{ t('console.developers.btnReject') }}</el-button>
            </template>
            <template v-else-if="row.status === 'suspended'">
              <el-button size="small" type="primary" @click="restore(row)">{{ t('console.developers.btnRestore') }}</el-button>
            </template>
            <template v-else-if="row.developer_status === 'approved'">
              <el-button size="small" type="warning" plain @click="openReason(row, 'suspend')">
                {{ t('console.developers.btnSuspend') }}
              </el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('console.developers.emptyFiltered')" />
        </template>
      </el-table>
    </el-card>

    <!-- 资料详情 -->
    <el-dialog v-model="detailVisible" :title="t('console.developers.detailTitle')" width="560px">
      <el-descriptions v-if="detailRow" :column="1" border>
        <el-descriptions-item :label="t('console.developers.labelEmail')">{{ detailRow.email }}</el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.colCompany')">
          {{ detailRow.company || t('console.developers.notProvided') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.colContact')">
          {{ detailRow.contact || t('console.developers.notProvided') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.colQualification')">
          {{ qualificationText(detailRow.developer_status) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.labelAccountStatus')">
          {{ detailRow.status === 'active' ? t('console.developers.accountActive') : t('console.common.disable') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.labelSubmittedAt')">
          {{ detailRow.developer_applied_at ? fmtTime(detailRow.developer_applied_at) : '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.labelRejectReason')">
          {{ detailRow.developer_reject_reason || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.labelCreatedAt')">{{ fmtTime(detailRow.created_at) }}</el-descriptions-item>
        <el-descriptions-item :label="t('console.developers.labelLastLogin')">
          {{ detailRow.last_login_at ? fmtTime(detailRow.last_login_at) : t('console.common.neverLogin') }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">{{ t('console.common.close') }}</el-button>
        <el-button
          v-if="detailRow?.developer_status === 'pending'"
          type="primary"
          @click="approve(detailRow!)"
        >
          {{ t('console.developers.approveButton') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 驳回 / 停用理由 -->
    <el-dialog v-model="reasonVisible" :title="reasonTitle" width="440px">
      <el-input
        v-model="reason"
        type="textarea"
        :rows="3"
        :placeholder="t('console.developers.reasonPlaceholder')"
      />
      <template #footer>
        <el-button @click="reasonVisible = false">{{ t('console.common.cancel') }}</el-button>
        <el-button type="danger" :loading="submitting" @click="submitReason">{{ t('console.common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Search, User, UserFilled, Bell, CircleCheck,
} from '@element-plus/icons-vue';
import ConsolePage from '../../components/console/ConsolePage.vue';
import api from '../../api';

const { t } = useI18n();

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
  reasonMode.value === 'reject'
    ? t('console.developers.reasonTitleReject')
    : t('console.developers.reasonTitleSuspend'),
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
  return {
    approved: t('console.developers.qualApproved'),
    pending: t('console.common.pending'),
    rejected: t('console.developers.rejected'),
    none: t('console.developers.qualNone'),
  }[s] || s;
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
      t('console.developers.approveConfirm', { email: row.email }),
      t('console.common.reviewConfirmTitle'),
      { type: 'success' },
    );
  } catch {
    return;
  }
  await api.patch(`/api/admin/developers/${row.id}/review`, { action: 'approve' });
  detailVisible.value = false;
  ElMessage.success(t('console.developers.approvedMsg'));
  notifyPendingChanged();
  await loadDevelopers();
}

async function restore(row: DeveloperRow) {
  try {
    await ElMessageBox.confirm(t('console.developers.restoreConfirm', { email: row.email }), t('console.common.confirm'), { type: 'info' });
  } catch {
    return;
  }
  await api.patch(`/api/admin/developers/${row.id}/status`, { status: 'active' });
  ElMessage.success(t('console.developers.restoredMsg'));
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
    ElMessage.warning(t('console.developers.reasonRequired'));
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
    ElMessage.success(t('console.developers.processedMsg'));
    notifyPendingChanged();
    await loadDevelopers();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t('console.common.opFailed'));
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
