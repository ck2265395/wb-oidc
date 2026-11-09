<template>
  <div v-loading="loading">
    <!-- 待办提醒 -->
    <el-alert
      v-if="pendingTotal > 0"
      class="mb16"
      type="warning"
      show-icon
      :closable="false"
      :title="`有 ${pendingTotal} 条待审核：开发者 ${stats.developers.pending} 个、应用 ${stats.clients.pending} 个`"
    />

    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="接入应用" :value="num(stats.clients.total)" />
          <div class="stat-sub">
            通过 {{ num(stats.clients.approved) }} · 待审 {{ num(stats.clients.pending) }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="第三方开发者" :value="num(stats.developers.total)" />
          <div class="stat-sub">
            已通过 {{ num(stats.developers.active) }} · 待审 {{ num(stats.developers.pending) }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="OIDC 会话" :value="num(stats.provider_sessions)" />
          <div class="stat-sub">终端用户在线会话</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="老系统用户" :value="num(stats.legacy_users)" />
          <div class="stat-sub">直连老库只读统计</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt16">
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-head">
              <span>📝 最近管理操作</span>
              <el-button size="small" text type="primary" @click="$router.push('/console/audit')">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="stats.recent_logs" size="small" stripe>
            <el-table-column prop="username" label="操作人" width="110" />
            <el-table-column prop="action" label="动作" min-width="140" />
            <el-table-column prop="target" label="对象" min-width="120" />
            <el-table-column label="时间" width="150">
              <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header>⚡ 快捷入口</template>
          <el-space direction="vertical" alignment="stretch" :size="10">
            <el-button plain @click="$router.push('/console/clients')">
              📦 应用管理（{{ num(stats.clients.pending) }} 个待审核）
            </el-button>
            <el-button plain @click="$router.push('/console/developers')">
              👥 开发者审核（{{ num(stats.developers.pending) }} 个待审核）
            </el-button>
            <el-button plain @click="$router.push('/console/legacy-users')">
              🔍 老库用户查询
            </el-button>
            <el-button plain @click="$router.push('/console/sessions')">
              🔑 会话管理（{{ num(stats.admin_sessions_active) }} 个管理端会话）
            </el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../../api';

interface OverviewStats {
  clients: { total: string; pending: string; approved: string; rejected: string; suspended: string };
  developers: { total: string; pending: string; active: string; suspended: string };
  admin_sessions_active: string;
  provider_sessions: string;
  legacy_users: string;
  recent_logs: Array<{
    id: number;
    username: string | null;
    action: string;
    target: string | null;
    created_at: string;
  }>;
}

const loading = ref(false);
const stats = ref<OverviewStats>({
  clients: { total: '0', pending: '0', approved: '0', rejected: '0', suspended: '0' },
  developers: { total: '0', pending: '0', active: '0', suspended: '0' },
  admin_sessions_active: '0',
  provider_sessions: '0',
  legacy_users: '0',
  recent_logs: [],
});

const pendingTotal = computed(
  () => Number(stats.value.clients.pending) + Number(stats.value.developers.pending),
);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get<{ data: OverviewStats }>('/api/admin/overview');
    stats.value = data.data;
  } finally {
    loading.value = false;
  }
}

function num(s: string): number {
  return parseInt(s || '0', 10);
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
}
.stat-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
