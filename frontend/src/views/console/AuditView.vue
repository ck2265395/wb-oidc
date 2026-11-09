<template>
  <div>
    <div class="toolbar">
      <el-input
        v-model="filters.action"
        placeholder="按动作筛选，如 client.review"
        clearable
        style="width: 220px"
        @keyup.enter="loadLogs"
        @clear="loadLogs"
      />
      <el-input
        v-model="filters.username"
        placeholder="按操作人筛选"
        clearable
        style="width: 180px"
        @keyup.enter="loadLogs"
        @clear="loadLogs"
      />
      <el-button type="primary" @click="loadLogs">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="logs" v-loading="loading" stripe size="small">
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="username" label="操作人" width="110" />
      <el-table-column prop="action" label="动作" min-width="150">
        <template #default="{ row }">
          <el-tag size="small" :type="actionTag(row.action)">{{ row.action }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="对象" min-width="120" />
      <el-table-column label="详情" min-width="220">
        <template #default="{ row }">
          <el-popover v-if="row.detail" placement="top" width="420" trigger="hover">
            <pre class="detail-json">{{ JSON.stringify(row.detail, null, 2) }}</pre>
            <template #reference>
              <el-link size="small" type="primary">查看</el-link>
            </template>
          </el-popover>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="130" />
      <template #empty>
        <el-empty description="暂无审计记录" />
      </template>
    </el-table>

    <el-pagination
      class="pager"
      layout="total, prev, pager, next, sizes"
      :total="total"
      v-model:current-page="page"
      v-model:page-size="size"
      :page-sizes="[20, 50, 100]"
      @change="loadLogs"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../api';

interface LogRow {
  id: number;
  username: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const loading = ref(false);
const logs = ref<LogRow[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const filters = ref({ action: '', username: '' });

onMounted(loadLogs);

async function loadLogs() {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: LogRow[]; total: number }>('/api/admin/logs', {
      params: {
        page: page.value,
        size: size.value,
        ...(filters.value.action ? { action: filters.value.action } : {}),
        ...(filters.value.username ? { username: filters.value.username } : {}),
      },
    });
    logs.value = data.data;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.value = { action: '', username: '' };
  page.value = 1;
  loadLogs();
}

function actionTag(action: string): string {
  if (action.includes('delete') || action.includes('reject') || action.includes('suspend')) {
    return 'danger';
  }
  if (action.includes('create') || action.includes('approve') || action.includes('active')) {
    return 'success';
  }
  return 'info';
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}
.detail-json {
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  margin: 0;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
  display: flex;
}
</style>
