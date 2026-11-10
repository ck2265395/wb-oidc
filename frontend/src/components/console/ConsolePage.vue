<template>
  <div class="cp">
    <div class="cp-head">
      <div class="cp-head-main">
        <div v-if="eyebrow" class="cp-eyebrow">{{ eyebrow }}</div>
        <h2 class="cp-title">{{ title }}</h2>
        <p v-if="desc" class="cp-desc">{{ desc }}</p>
      </div>
      <div v-if="$slots.actions" class="cp-actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
/** 控制台统一页头：标题 + 说明 + 右侧操作区，各页面只负责内容 */
defineProps<{
  eyebrow?: string;
  title: string;
  desc?: string;
}>();
</script>
