<template>
  <el-empty :description="t('console.placeholder.comingSoon', { title })" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ title: string }>();
const { t } = useI18n();
</script>
