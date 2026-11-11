<template>
  <ConsolePage
    eyebrow="DASHBOARD"
    :title="t('console.overview.title')"
    :desc="t('console.overview.desc')"
  >
    <template #actions>
      <el-button :icon="Refresh" @click="load">{{ t('console.overview.refreshData') }}</el-button>
      <el-button type="primary" :icon="Bell" @click="goReview">{{ t('console.overview.handlePending') }}</el-button>
    </template>

    <div v-loading="loading">
      <!-- 待办提醒：直接给出审核入口 -->
      <el-card v-if="pendingTotal > 0" shadow="never" class="todo-card box-card">
        <div class="todo-inner">
          <div class="todo-icon"><el-icon><Bell /></el-icon></div>
          <div class="todo-text">
            <div class="todo-title">{{ t('console.overview.todoTitle', { n: pendingTotal }) }}</div>
            <div class="todo-desc">
              {{
                t('console.overview.todoDesc', {
                  dev: num(stats.developers.pending),
                  app: num(stats.clients.pending),
                })
              }}
            </div>
          </div>
          <div class="todo-actions">
            <el-button type="primary" @click="$router.push('/console/developers')">
              {{ t('console.overview.reviewDevelopers') }}
            </el-button>
            <el-button @click="$router.push('/console/clients')">{{ t('console.overview.reviewApps') }}</el-button>
          </div>
        </div>
      </el-card>
      <el-card v-else shadow="never" class="todo-card box-card todo-done">
        <div class="todo-inner">
          <div class="todo-icon success"><el-icon><CircleCheck /></el-icon></div>
          <div class="todo-text">
            <div class="todo-title">{{ t('console.overview.allDoneTitle') }}</div>
            <div class="todo-desc">{{ t('console.overview.allDoneDesc') }}</div>
          </div>
        </div>
      </el-card>

      <el-row :gutter="16" class="stat-grid">
        <el-col :span="6">
          <el-card shadow="never" class="stat-card">
            <div class="stat-flex">
              <div>
                <div class="stat-label">{{ t('console.overview.statApps') }}</div>
                <div class="stat-value">{{ num(stats.clients.total) }}</div>
                <div class="stat-sub">
                  {{
                    t('console.overview.statAppsSub', {
                      approved: num(stats.clients.approved),
                      pending: num(stats.clients.pending),
                    })
                  }}
                </div>
              </div>
              <div class="stat-icon"><el-icon><Grid /></el-icon></div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" class="stat-card">
            <div class="stat-flex">
              <div>
                <div class="stat-label">{{ t('console.overview.statUsers') }}</div>
                <div class="stat-value">{{ num(stats.developers.total) }}</div>
                <div class="stat-sub">
                  {{
                    t('console.overview.statUsersSub', {
                      active: num(stats.developers.active),
                      pending: num(stats.developers.pending),
                      normal: num(stats.developers.normal),
                    })
                  }}
                </div>
              </div>
              <div class="stat-icon"><el-icon><User /></el-icon></div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" class="stat-card">
            <div class="stat-flex">
              <div>
                <div class="stat-label">{{ t('console.overview.statSessions') }}</div>
                <div class="stat-value">{{ num(stats.provider_sessions) }}</div>
                <div class="stat-sub">{{ t('console.overview.statSessionsSub') }}</div>
              </div>
              <div class="stat-icon success"><el-icon><Key /></el-icon></div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" class="stat-card">
            <div class="stat-flex">
              <div>
                <div class="stat-label">{{ t('console.overview.statLegacy') }}</div>
                <div class="stat-value">{{ num(stats.legacy_users) }}</div>
                <div class="stat-sub">{{ t('console.overview.statLegacySub') }}</div>
              </div>
              <div class="stat-icon"><el-icon><DataAnalysis /></el-icon></div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16" class="bottom-grid">
        <el-col :span="14">
          <el-card shadow="never" class="box-card">
            <template #header>
              <div class="card-head">
                <span class="head-left"><el-icon><Document /></el-icon>{{ t('console.overview.recentActions') }}</span>
                <el-button size="small" text type="primary" @click="$router.push('/console/audit')">
                  {{ t('console.overview.viewAll') }} →
                </el-button>
              </div>
            </template>
            <el-table :data="stats.recent_logs" size="small" stripe>
              <el-table-column prop="username" :label="t('console.common.operator')" width="110">
                <template #default="{ row }">{{ row.username || '—' }}</template>
              </el-table-column>
              <el-table-column prop="action" :label="t('console.common.action')" min-width="140">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ row.action }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="target" :label="t('console.common.target')" min-width="120">
                <template #default="{ row }">{{ row.target || '—' }}</template>
              </el-table-column>
              <el-table-column :label="t('console.common.time')" width="160">
                <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
              </el-table-column>
              <template #empty><el-empty :description="t('console.overview.noLogs')" :image-size="60" /></template>
            </el-table>
          </el-card>
        </el-col>
        <el-col :span="10">
          <el-card shadow="never" class="box-card">
            <template #header>
              <div class="card-head">
                <span class="head-left"><el-icon><Grid /></el-icon>{{ t('console.overview.quickLinks') }}</span>
              </div>
            </template>
            <div class="quick-list">
              <div class="quick-item" @click="$router.push('/console/developers')">
                <div class="quick-icon"><el-icon><User /></el-icon></div>
                <div class="quick-text">
                  <div class="quick-title">{{ t('console.overview.quickDevTitle') }}</div>
                  <div class="quick-desc">{{ t('console.overview.quickDevDesc') }}</div>
                </div>
                <el-tag v-if="num(stats.developers.pending)" type="danger" size="small" effect="dark" round>
                  {{ num(stats.developers.pending) }}
                </el-tag>
                <el-icon class="quick-arrow"><ArrowRight /></el-icon>
              </div>
              <div class="quick-item" @click="$router.push('/console/clients')">
                <div class="quick-icon"><el-icon><Grid /></el-icon></div>
                <div class="quick-text">
                  <div class="quick-title">{{ t('console.overview.quickAppTitle') }}</div>
                  <div class="quick-desc">{{ t('console.overview.quickAppDesc') }}</div>
                </div>
                <el-tag v-if="num(stats.clients.pending)" type="warning" size="small" effect="dark" round>
                  {{ num(stats.clients.pending) }}
                </el-tag>
                <el-icon class="quick-arrow"><ArrowRight /></el-icon>
              </div>
              <div class="quick-item" @click="$router.push('/console/legacy-users')">
                <div class="quick-icon"><el-icon><Search /></el-icon></div>
                <div class="quick-text">
                  <div class="quick-title">{{ t('console.overview.quickLegacyTitle') }}</div>
                  <div class="quick-desc">{{ t('console.overview.quickLegacyDesc') }}</div>
                </div>
                <el-icon class="quick-arrow"><ArrowRight /></el-icon>
              </div>
              <div class="quick-item" @click="$router.push('/console/sessions')">
                <div class="quick-icon"><el-icon><Key /></el-icon></div>
                <div class="quick-text">
                  <div class="quick-title">{{ t('console.overview.quickSessionTitle') }}</div>
                  <div class="quick-desc">
                    {{ t('console.overview.quickSessionDesc', { n: num(stats.admin_sessions_active) }) }}
                  </div>
                </div>
                <el-icon class="quick-arrow"><ArrowRight /></el-icon>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </ConsolePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Refresh, Bell, CircleCheck, Grid, User, Key, DataAnalysis,
  Document, Search, ArrowRight,
} from '@element-plus/icons-vue';
import ConsolePage from '../../components/console/ConsolePage.vue';
import api from '../../api';

const { t } = useI18n();
const router = useRouter();

interface OverviewStats {
  clients: { total: string; pending: string; approved: string; rejected: string; suspended: string };
  developers: { total: string; pending: string; active: string; suspended: string; normal: string };
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
  developers: { total: '0', pending: '0', active: '0', suspended: '0', normal: '0' },
  admin_sessions_active: '0',
  provider_sessions: '0',
  legacy_users: '0',
  recent_logs: [],
});

const pendingTotal = computed(
  () => Number(stats.value.clients.pending) + Number(stats.value.developers.pending),
);

onMounted(load);

function goReview() {
  router.push(Number(stats.value.developers.pending) > 0 ? '/console/developers' : '/console/clients');
}

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
.todo-card {
  margin-bottom: 18px;
  border-left: 3px solid #e6a23c !important;
}
.todo-done {
  border-left-color: #17845a !important;
}
.todo-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.todo-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #fff7e6;
  color: #b7791f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.todo-icon.success {
  background: #ecfdf3;
  color: #17845a;
}
.todo-text {
  flex: 1;
}
.todo-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.todo-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ink-500);
}
.todo-actions {
  display: flex;
  gap: 10px;
}
.stat-grid {
  margin-bottom: 18px;
}
.quick-list {
  display: flex;
  flex-direction: column;
}
.quick-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 6px;
  border-bottom: 1px solid #f0f3f8;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}
.quick-item:last-child {
  border-bottom: none;
}
.quick-item:hover {
  background: #f7faff;
}
.quick-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--brand-50);
  color: var(--brand-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.quick-text {
  flex: 1;
}
.quick-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-900);
}
.quick-desc {
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-300);
}
.quick-arrow {
  color: var(--ink-300);
}
</style>
