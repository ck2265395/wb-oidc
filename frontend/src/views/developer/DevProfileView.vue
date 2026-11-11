<template>
  <div class="profile-wrap">
    <div class="profile-head">
      <div>
        <h2 class="page-title">{{ t('developer.profile.title') }}</h2>
        <p class="page-desc">{{ t('developer.profile.desc') }}</p>
      </div>
      <el-button type="primary" :icon="EditPen" @click="$router.push('/profile/edit')">
        {{ t('developer.common.editProfile') }}
      </el-button>
    </div>

    <div class="profile-card" v-loading="loading">
      <div class="profile-top">
        <el-avatar :size="56" class="profile-avatar">{{ avatarText }}</el-avatar>
        <div class="profile-id">
          <div class="profile-email">{{ info?.email }}</div>
          <div class="tag-row">
            <el-tag :type="info?.status === 'active' ? 'success' : 'danger'" size="small" round effect="light">
              {{ t('developer.common.accountTag', { status: accountText }) }}
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
        :title="t('developer.profile.rejectedAlert', { reason: info?.developer_reject_reason || t('developer.profile.fixAndResubmit') })"
      />
      <el-alert
        v-if="info?.status === 'suspended'"
        class="mt24"
        type="error"
        :closable="false"
        show-icon
        :title="t('developer.profile.suspendedAlert', { reason: info?.reject_reason || t('developer.profile.contactAdmin') })"
      />

      <el-descriptions :column="2" border class="mt24">
        <el-descriptions-item :label="t('developer.common.email')">{{ info?.email || '—' }}</el-descriptions-item>
        <el-descriptions-item :label="t('developer.common.accountStatus')">{{ accountText }}</el-descriptions-item>
        <el-descriptions-item :label="t('developer.common.qualification')">{{ qualificationText }}</el-descriptions-item>
        <el-descriptions-item :label="t('developer.profile.appliedAt')">
          {{ info?.developer_applied_at ? fmtTime(info.developer_applied_at) : '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('developer.common.company')">{{ info?.company || t('developer.common.notFilled') }}</el-descriptions-item>
        <el-descriptions-item :label="t('developer.common.contact')">{{ info?.contact || t('developer.common.notFilled') }}</el-descriptions-item>
        <el-descriptions-item :label="t('developer.common.registeredAt')">{{ fmtTime(info?.created_at) }}</el-descriptions-item>
        <el-descriptions-item :label="t('developer.common.lastLoginAt')">{{ info?.last_login_at ? fmtTime(info.last_login_at) : '—' }}</el-descriptions-item>
      </el-descriptions>

      <p v-if="info && ['none', 'rejected'].includes(info.developer_status)" class="profile-hint">
        {{ t('developer.profile.createHint') }}
      </p>
      <div class="profile-actions">
        <el-button @click="$router.push('/apps')">{{ actionText }}</el-button>
        <el-button @click="$router.push('/docs')">{{ t('developer.common.viewDocs') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { EditPen } from '@element-plus/icons-vue';
import { DeveloperInfo, devFetchMe, getCurrentDeveloper } from '../../api/dev';

const { t } = useI18n();
const info = ref<DeveloperInfo | null>(getCurrentDeveloper());
const loading = ref(true);

onMounted(async () => {
  const fresh = await devFetchMe();
  if (fresh) info.value = fresh;
  loading.value = false;
});

const avatarText = computed(() => (info.value?.email || '?').slice(0, 1).toUpperCase());
const accountText = computed(() =>
  info.value?.status === 'suspended'
    ? t('developer.common.statusSuspended')
    : t('developer.common.statusNormal'),
);
const qualificationMap = computed<Record<string, string>>(() => ({
  none: t('developer.common.qualNone'),
  pending: t('developer.common.qualPending'),
  approved: t('developer.common.qualApproved'),
  rejected: t('developer.common.qualRejected'),
}));
const qualificationText = computed(
  () =>
    qualificationMap.value[info.value?.developer_status || ''] ||
    t('developer.common.qualNone'),
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
      return t('developer.profile.actionCreate');
    case 'pending':
      return t('developer.profile.actionCheckProgress');
    case 'rejected':
      return t('developer.profile.actionReapply');
    default:
      return t('developer.profile.actionBack');
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
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
.profile-hint {
  margin: 24px 0 0;
  font-size: 13px;
  color: #6b7280;
}
.profile-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
</style>
