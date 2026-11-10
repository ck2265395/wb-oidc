<template>
  <div class="profile-wrap">
    <div class="profile-head">
      <h2 class="page-title">账号资料</h2>
      <p class="page-desc">账号信息、开发者资格与审核状态。</p>
    </div>

    <div class="profile-card" v-loading="loading">
      <div class="profile-top">
        <el-avatar :size="56" class="profile-avatar">{{ avatarText }}</el-avatar>
        <div class="profile-id">
          <div class="profile-email">{{ info?.email }}</div>
          <div class="tag-row">
            <el-tag :type="info?.status === 'active' ? 'success' : 'danger'" size="small" round effect="light">
              账号{{ accountText }}
            </el-tag>
            <el-tag :type="qualificationTag" size="small" round effect="light">
              {{ qualificationText }}
            </el-tag>
          </div>
        </div>
      </div>

      <el-alert
        v-if="info?.developer_status === 'rejected'"
        class="mt24"
        type="error"
        :closable="false"
        show-icon
        :title="`开发者资格申请未通过：${info?.developer_reject_reason || '请补齐资料后重新提交'}`"
      />
      <el-alert
        v-if="info?.status === 'suspended'"
        class="mt24"
        type="error"
        :closable="false"
        show-icon
        :title="`账号已停用：${info?.reject_reason || '请联系平台管理员'}`"
      />

      <el-descriptions :column="2" border class="mt24">
        <el-descriptions-item label="邮箱">{{ info?.email || '—' }}</el-descriptions-item>
        <el-descriptions-item label="账号状态">{{ accountText }}</el-descriptions-item>
        <el-descriptions-item label="开发者资格">{{ qualificationText }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">
          {{ info?.developer_applied_at ? fmtTime(info.developer_applied_at) : '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="公司 / 团队">{{ info?.company || '未填写' }}</el-descriptions-item>
        <el-descriptions-item label="联系方式">{{ info?.contact || '未填写' }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ fmtTime(info?.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="最近登录">{{ info?.last_login_at ? fmtTime(info.last_login_at) : '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="profile-actions">
        <el-button type="primary" @click="$router.push('/apps')">{{ actionText }}</el-button>
        <el-button @click="$router.push('/docs')">查看接入文档</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { DeveloperInfo, devFetchMe, getCurrentDeveloper } from '../../api/dev';

const info = ref<DeveloperInfo | null>(getCurrentDeveloper());
const loading = ref(true);

onMounted(async () => {
  const fresh = await devFetchMe();
  if (fresh) info.value = fresh;
  loading.value = false;
});

const avatarText = computed(() => (info.value?.email || '?').slice(0, 1).toUpperCase());
const accountText = computed(() =>
  info.value?.status === 'suspended' ? '已停用' : '正常',
);
const qualificationMap: Record<string, string> = {
  none: '普通用户',
  pending: '资格审核中',
  approved: '已认证开发者',
  rejected: '申请未通过',
};
const qualificationText = computed(
  () => qualificationMap[info.value?.developer_status || ''] || '普通用户',
);
const qualificationTag = computed(
  () =>
    ({
      none: 'info',
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
    }[info.value?.developer_status || 'none'] || 'info'),
);
const actionText = computed(() => {
  switch (info.value?.developer_status) {
    case 'approved':
      return '前往我的应用';
    case 'pending':
      return '查看审核进度';
    case 'rejected':
      return '重新申请开发者资格';
    default:
      return '申请成为开发者';
  }
});

function fmtTime(s?: string | null): string {
  return s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '—';
}
</script>

<style scoped>
.profile-wrap {
  max-width: 880px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}
.profile-head {
  margin-bottom: 24px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 800;
  color: #0b1220;
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.profile-card {
  background: #fff;
  border: 1px solid #e3eaf3;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.04);
}
.profile-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.profile-avatar {
  background: linear-gradient(135deg, #0b57d0, #0a3d91);
  color: #fff;
  font-weight: 700;
  font-size: 22px;
}
.profile-email {
  font-size: 17px;
  font-weight: 700;
  color: #0b1220;
  margin-bottom: 8px;
}
.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mt24 {
  margin-top: 24px;
}
.profile-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}
</style>
