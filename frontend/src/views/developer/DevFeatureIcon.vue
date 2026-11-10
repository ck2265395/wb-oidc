<template>
  <!-- 单色线性图标：只用 currentColor 描边，无填充、无彩色，跟随品牌色 -->
  <svg
    class="feature-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <!-- 标准协议：盾牌 + 校验勾 -->
    <template v-if="name === 'protocol'">
      <path d="M12 21.5s7.5-3.7 7.5-9.5V5.4L12 2.5 4.5 5.4V12c0 5.8 7.5 9.5 7.5 9.5Z" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.4" />
    </template>

    <!-- 存量用户直连：用户组 -->
    <template v-else-if="name === 'users'">
      <path d="M15.5 20v-1.6a3.8 3.8 0 0 0-3.8-3.8H7.1a3.8 3.8 0 0 0-3.8 3.8V20" />
      <circle cx="9.4" cy="7.2" r="3.4" />
      <path d="M20.7 20v-1.6a3.8 3.8 0 0 0-2.9-3.69" />
      <path d="M16.2 3.9a3.4 3.4 0 0 1 0 6.6" />
    </template>

    <!-- 审核机制：审核清单 + 通过勾 -->
    <template v-else-if="name === 'review'">
      <rect x="4.5" y="4.5" width="15" height="16.5" rx="2" />
      <rect x="9" y="2.5" width="6" height="4" rx="1" />
      <path d="m8.4 13.2 2.4 2.4 4.8-5" />
    </template>

    <!-- 安全默认：密钥 -->
    <template v-else-if="name === 'security'">
      <circle cx="8" cy="14.5" r="4.4" />
      <path d="m11.2 11.3 8.3-8.3" />
      <path d="m16.3 6.2 2.5 2.5" />
      <path d="m13.7 8.8 2.5 2.5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<style scoped>
.feature-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
