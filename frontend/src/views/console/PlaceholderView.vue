<template>
  <el-empty :description="`「${title}」页面在后续批次上线，敬请期待`" />
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
