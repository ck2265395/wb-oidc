<template>
  <ConsolePage
    eyebrow="AUDIT LOG"
    :title="t('console.audit.title')"
    :desc="t('console.audit.desc')"
  >
    <el-card shadow="never" class="box-card">
      <div class="cp-toolbar">
      <el-input
        v-model="filters.action"
        :placeholder="t('console.audit.actionPlaceholder')"
        clearable
        style="width: 220px"
        @keyup.enter="loadLogs"
        @clear="loadLogs"
      />
      <el-input
        v-model="filters.username"
        :placeholder="t('console.audit.operatorPlaceholder')"
        clearable
        style="width: 180px"
        @keyup.enter="loadLogs"
        @clear="loadLogs"
      />
      <el-select
        v-model="filters.actor_type"
        :placeholder="t('console.audit.actorType')"
        clearable
        style="width: 140px"
        @change="loadLogs"
      >
        <el-option :label="t('console.audit.actorAdmin')" value="admin" />
        <el-option :label="t('console.audit.actorDeveloper')" value="developer" />
      </el-select>
      <el-button type="primary" @click="loadLogs">{{ t('console.common.search') }}</el-button>
      <el-button @click="resetFilters">{{ t('console.common.reset') }}</el-button>
    </div>

    <el-table :data="logs" v-loading="loading" stripe size="small">
      <el-table-column :label="t('console.common.time')" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column :label="t('console.audit.colActorType')" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.actor_type === 'developer' ? 'warning' : 'primary'">
            {{ row.actor_type === 'developer' ? t('console.audit.actorDeveloper') : t('console.audit.actorAdmin') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="username" :label="t('console.common.operator')" min-width="180" show-overflow-tooltip />
      <el-table-column prop="action" :label="t('console.common.action')" min-width="150">
        <template #default="{ row }">
          <el-tag size="small" :type="actionTag(row.action)">{{ row.action }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" :label="t('console.common.target')" min-width="120" />
      <el-table-column :label="t('console.audit.colDetail')" min-width="220">
        <template #default="{ row }">
          <el-popover v-if="row.detail" placement="top" width="420" trigger="click">
            <pre class="detail-json">{{ JSON.stringify(row.detail, null, 2) }}</pre>
            <template #reference>
              <el-link size="small" type="primary">{{ t('console.common.view') }}</el-link>
            </template>
          </el-popover>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="130" />
      <template #empty>
        <el-empty :description="t('console.audit.empty')" />
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
    </el-card>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import ConsolePage from '../../components/console/ConsolePage.vue';
import api from '../../api';

const { t } = useI18n();

interface LogRow {
  id: string;
  actor_type: 'admin' | 'developer';
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
const filters = ref({ action: '', username: '', actor_type: '' });

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
        ...(filters.value.actor_type ? { actor_type: filters.value.actor_type } : {}),
      },
    });
    logs.value = data.data;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.value = { action: '', username: '', actor_type: '' };
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
