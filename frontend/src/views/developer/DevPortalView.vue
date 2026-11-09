<template>
  <div class="dev-page">
    <el-container class="layout">
      <el-aside width="210px" class="aside">
        <div class="logo">🚪 开发者门户</div>
        <el-menu :default-active="route.path" router class="menu">
          <el-menu-item index="/developer/apps">
            <span>📦 我的应用</span>
          </el-menu-item>
          <el-menu-item index="/developer/docs">
            <span>📖 接入文档</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <el-space :size="12">
            <el-tag
              :type="dev?.status === 'active' ? 'success' : dev?.status === 'pending' ? 'warning' : 'danger'"
              size="small"
            >
              {{ statusText(dev?.status) }}
            </el-tag>
            <span class="dev-name">{{ dev?.email }}</span>
            <span v-if="dev?.company" class="dev-company">{{ dev.company }}</span>
          </el-space>
          <el-space :size="4">
            <el-button text @click="handleLogout">退出登录</el-button>
          </el-space>
        </el-header>
        <el-main class="main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { devFetchMe, devLogout, getCurrentDeveloper, DeveloperInfo } from '../../api/dev';

const router = useRouter();
const route = useRoute();
const dev = ref<DeveloperInfo | null>(getCurrentDeveloper());

onMounted(async () => {
  dev.value = (await devFetchMe()) || getCurrentDeveloper();
});

function statusText(status?: string): string {
  return status === 'active' ? '已通过' : status === 'pending' ? '待审核' : '已停用';
}

async function handleLogout() {
  try {
    await devLogout();
  } finally {
    ElMessage.success('已退出登录');
    router.replace('/developer/login');
  }
}
</script>

<style scoped>
.dev-page {
  height: 100%;
  background: #f5f7fa;
}
.layout {
  height: 100vh;
}
.aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
}
.menu {
  border-right: none;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.dev-name {
  color: #606266;
  font-size: 14px;
}
.dev-company {
  color: #909399;
  font-size: 12px;
}
.main {
  overflow: auto;
}
</style>
