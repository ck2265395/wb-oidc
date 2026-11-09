<template>
  <div>
    <el-alert
      class="mb16"
      type="info"
      :closable="false"
      title="终端用户通过 OIDC 登录后的会话（oidc-provider Session）。吊销后用户需要重新登录。"
    />

    <el-table :data="sessions" v-loading="loading" stripe>
      <el-table-column label="会话 ID" min-width="260">
        <template #default="{ row }">
          <el-text size="small" copyable>{{ row.id }}</el-text>
        </template>
      </el-table-column>
      <el-table-column prop="account_id" label="登录账号(sub)" min-width="180" />
      <el-table-column label="登录时间" width="160">
        <template #default="{ row }">{{ row.login_at ? fmtTime(row.login_at) : '—' }}</template>
      </el-table-column>
      <el-table-column label="已授权应用" width="100">
        <template #default="{ row }">{{ row.authorized_clients }}</template>
      </el-table-column>
      <el-table-column label="过期时间" width="160">
        <template #default="{ row }">{{ row.expires_at ? fmtTime(row.expires_at) : '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="danger" link @click="revoke(row)">吊销</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无活跃会话" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../api';

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
      `确认吊销会话 ${row.id.slice(0, 16)}...？该用户需要重新登录。`,
      '吊销会话',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await api.delete(`/api/admin/sessions/${encodeURIComponent(row.id)}`);
  ElMessage.success('已吊销');
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
