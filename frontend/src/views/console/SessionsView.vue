<template>
  <ConsolePage
    eyebrow="SESSIONS"
    :title="t('console.sessions.title')"
    :desc="t('console.sessions.desc')"
  >
    <el-alert
      class="mb16"
      type="info"
      show-icon
      :closable="false"
      :title="t('console.sessions.alert')"
    />

    <el-card shadow="never" class="box-card">
    <el-table :data="sessions" v-loading="loading" stripe>
      <el-table-column :label="t('console.sessions.colSessionId')" min-width="260">
        <template #default="{ row }">
          <el-text size="small" copyable>{{ row.id }}</el-text>
        </template>
      </el-table-column>
      <el-table-column prop="account_id" :label="t('console.sessions.colAccount')" min-width="180" />
      <el-table-column :label="t('console.sessions.colLoginAt')" width="160">
        <template #default="{ row }">{{ row.login_at ? fmtTime(row.login_at) : '—' }}</template>
      </el-table-column>
      <el-table-column :label="t('console.sessions.colAuthorizedApps')" width="100">
        <template #default="{ row }">{{ row.authorized_clients }}</template>
      </el-table-column>
      <el-table-column :label="t('console.sessions.colExpiresAt')" width="160">
        <template #default="{ row }">{{ row.expires_at ? fmtTime(row.expires_at) : '—' }}</template>
      </el-table-column>
      <el-table-column :label="t('console.common.actions')" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="danger" link @click="revoke(row)">{{ t('console.sessions.revoke') }}</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="t('console.sessions.empty')" />
      </template>
    </el-table>

    <el-pagination
      class="pager"
      layout="total, prev, pager, next"
      :total="total"
      v-model:current-page="page"
      :page-size="size"
      @change="loadSessions"
    />
    </el-card>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import ConsolePage from '../../components/console/ConsolePage.vue';
import api from '../../api';

const { t } = useI18n();

interface SessionRow {
  id: string;
  account_id: string | null;
  login_at: string | null;
  authorized_clients: number;
  expires_at: string | null;
}

const loading = ref(false);
const sessions = ref<SessionRow[]>([]);
const total = ref(0);
const page = ref(1);
const size = 20;

onMounted(loadSessions);

async function loadSessions() {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: SessionRow[]; total: number }>('/api/admin/sessions', {
      params: { page: page.value, size },
    });
    sessions.value = data.data;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function revoke(row: SessionRow) {
  try {
    await ElMessageBox.confirm(
      t('console.sessions.revokeConfirm', { id: row.id.slice(0, 16) }),
      t('console.sessions.revokeTitle'),
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await api.delete(`/api/admin/sessions/${encodeURIComponent(row.id)}`);
  ElMessage.success(t('console.sessions.revoked'));
  await loadSessions();
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
  display: flex;
}
</style>
