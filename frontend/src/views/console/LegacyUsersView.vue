<template>
  <ConsolePage
    eyebrow="LEGACY USERS"
    :title="t('console.legacyUsers.title')"
    :desc="t('console.legacyUsers.desc')"
  >
    <el-alert
      class="mb16"
      type="info"
      show-icon
      :closable="false"
      :title="t('console.legacyUsers.alert')"
    />

    <el-card shadow="never" class="box-card">
      <div class="cp-toolbar">
      <el-input
        v-model="keyword"
        :placeholder="t('console.legacyUsers.searchPlaceholder')"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">{{ t('console.common.search') }}</el-button>
    </div>

    <el-table :data="users" v-loading="loading" stripe size="small">
      <el-table-column
        v-for="col in displayColumns"
        :key="col"
        :prop="col"
        :label="col"
        min-width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ formatCell(row[col]) }}</template>
      </el-table-column>
      <template #empty>
        <el-empty :description="searched ? t('console.legacyUsers.emptyNoMatch') : t('console.legacyUsers.emptyInit')" />
      </template>
    </el-table>

    <el-pagination
      v-if="total > 0"
      class="pager"
      layout="total, prev, pager, next"
      :total="total"
      v-model:current-page="page"
      :page-size="size"
      @change="search"
    />
    </el-card>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import ConsolePage from '../../components/console/ConsolePage.vue';
import api from '../../api';

const { t } = useI18n();
const loading = ref(false);
const keyword = ref('');
const users = ref<Array<Record<string, any>>>([]);
const total = ref(0);
const page = ref(1);
const size = 20;
const searched = ref(false);

/** 优先展示常用列，其余列跟随 */
const PRIORITY = ['username', 'nickname', 'email', 'phone', 'status', 'uuid'];
const displayColumns = computed(() => {
  if (!users.value.length) return [];
  const keys = Object.keys(users.value[0]);
  const head = PRIORITY.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !head.includes(k));
  return [...head, ...rest].slice(0, 10);
});

onMounted(() => {
  // 进页面先展示前 20 个，方便快速核对
  search();
});

async function search() {
  loading.value = true;
  searched.value = true;
  try {
    const { data } = await api.get<{ data: Array<Record<string, any>>; total: number }>(
      '/api/admin/legacy-users',
      {
        params: {
          keyword: keyword.value || undefined,
          page: page.value,
          size,
        },
      },
    );
    users.value = data.data;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
}
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
  display: flex;
}
</style>
