<template>
  <div class="profile-wrap">
    <div class="profile-head">
      <h2 class="page-title">账号资料</h2>
      <p class="page-desc">开发者账号信息与审核状态。</p>
    </div>

    <div class="profile-card">
      <div class="profile-top">
        <el-avatar :size="56" class="profile-avatar">{{ avatarText }}</el-avatar>
        <div class="profile-id">
          <div class="profile-email">{{ info?.email }}</div>
          <el-tag
            :type="info?.status === 'active' ? 'success' : info?.status === 'pending' ? 'warning' : 'danger'"
            size="small"
            round
            effect="light"
          >
            {{ statusText }}
          </el-tag>
          <el-alert
            v-if="info?.status === 'suspended'"
            class="mt12"
            type="error"
            :closable="false"
            :title="`停用原因：${info?.reject_reason || '请联系平台管理员'}`"
          />
        </div>
      </div>

      <el-descriptions :column="2" border class="mt24">
        <el-descriptions-item label="邮箱">{{ info?.email || '—' }}</el-descriptions-item>
        <el-descriptions-item label="账号状态">{{ statusText }}</el-descriptions-item>
        <el-descriptions-item label="公司 / 团队">{{ info?.company || '—' }}</el-descriptions-item>
        <el-descriptions-item label="联系方式">{{ info?.contact || '—' }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ fmtTime(info?.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="最近登录">{{ info?.last_login_at ? fmtTime(info.last_login_at) : '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        class="mt24"
        type="info"
        :closable="false"
        title="如需修改公司信息或找回密码，请联系平台管理员处理。"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { DeveloperInfo, getCurrentDeveloper } from '../../api/dev';

const info = ref<DeveloperInfo | null>(getCurrentDeveloper());

onMounted(() => {
  if (!info.value) info.value = getCurrentDeveloper();
});

const avatarText = computed(() => (info.value?.email || '?').slice(0, 1).toUpperCase());
const statusText = computed(() => {
  const map: Record<string, string> = {
    active: '已通过审核',
    pending: '待管理员审核',
    suspended: '已停用',
  };
  return map[info.value?.status || ''] || info.value?.status || '—';
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
  color: #111827;
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
}
.profile-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 28px;
  box-shadow: 0 1px 3px rgba(17, 24, 39, 0.04);
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
  color: #111827;
  margin-bottom: 6px;
}
.mt12 {
  margin-top: 12px;
}
.mt24 {
  margin-top: 24px;
}
</style>
