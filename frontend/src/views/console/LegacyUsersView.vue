<template>
  <div>
    <el-alert
      class="mb16"
      type="info"
      :closable="false"
      title="直连老系统数据库的只读查询，密码等敏感字段已脱敏。用于核对存量用户是否可接入。"
    />

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="用户名 / 邮箱 / 手机号"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
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
        <el-empty :description="searched ? '没有匹配的用户' : '输入关键词后查询老库用户'" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../api';

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
