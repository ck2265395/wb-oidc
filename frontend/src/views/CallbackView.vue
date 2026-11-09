<template>
  <div class="callback-page">
    <el-card class="box-card">
      <template #header><span>🎉 OIDC 授权码流程结果</span></template>

      <div v-if="error">
        <el-result icon="error" title="授权失败" :sub-title="error" />
      </div>

      <div v-else-if="tokens">
        <el-descriptions :column="1" border class="mb16">
          <el-descriptions-item label="当前用户（id_token sub）">
            {{ idToken?.sub }}
          </el-descriptions-item>
          <el-descriptions-item v-if="idToken?.nickname || idToken?.name" label="昵称">
            {{ idToken?.nickname || idToken?.name }}
          </el-descriptions-item>
          <el-descriptions-item v-if="idToken?.email" label="邮箱">
            {{ idToken?.email }}
          </el-descriptions-item>
        </el-descriptions>

        <el-collapse>
          <el-collapse-item title="Token 响应（原始 JSON）">
            <pre class="json">{{ JSON.stringify(tokens, null, 2) }}</pre>
          </el-collapse-item>
          <el-collapse-item title="id_token 解码">
            <pre class="json">{{ JSON.stringify(idToken, null, 2) }}</pre>
          </el-collapse-item>
          <el-collapse-item v-if="userinfo" title="userinfo 响应">
            <pre class="json">{{ JSON.stringify(userinfo, null, 2) }}</pre>
          </el-collapse-item>
        </el-collapse>

        <div class="mt16">
          <el-button type="primary" :loading="loadingUserinfo" @click="fetchUserinfo">
            调用 /userinfo 获取用户信息
          </el-button>
          <el-button @click="back">返回控制台</el-button>
        </div>
      </div>

      <div v-else class="center">
        <el-skeleton :rows="3" animated />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ISSUER, decodeJwtPayload } from '../api';

const route = useRoute();
const router = useRouter();

const error = ref('');
const tokens = ref<Record<string, unknown> | null>(null);
const userinfo = ref<Record<string, unknown> | null>(null);
const loadingUserinfo = ref(false);

const idToken = computed(() => {
  const t = tokens.value?.id_token;
  return typeof t === 'string' ? decodeJwtPayload(t) : null;
});

async function exchange() {
  const stored = sessionStorage.getItem('wb_oidc_pkce');
  if (!stored) {
    error.value = '本地没有找到 PKCE 上下文（请从控制台「测试登录」发起）';
    return;
  }
  const { verifier, state, clientId, redirectUri } = JSON.parse(stored);
  const code = route.query.code as string | undefined;
  const returnedState = route.query.state as string | undefined;
  const errParam = route.query.error as string | undefined;

  if (errParam) {
    error.value = `${errParam}: ${route.query.error_description || ''}`;
    return;
  }
  if (!code) {
    error.value = '回调缺少 code 参数';
    return;
  }
  if (returnedState !== state) {
    error.value = 'state 校验失败，可能存在 CSRF 风险，已中止';
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });
    const res = await fetch(`${ISSUER}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json();
    if (!res.ok) {
      error.value = `token 端点返回错误: ${json.error} - ${json.error_description || ''}`;
      return;
    }
    tokens.value = json;
    sessionStorage.removeItem('wb_oidc_pkce');
  } catch (e: any) {
    error.value = e?.message || '换取 token 失败';
  }
}

async function fetchUserinfo() {
  const accessToken = tokens.value?.access_token as string | undefined;
  if (!accessToken) {
    ElMessage.warning('没有 access_token');
    return;
  }
  loadingUserinfo.value = true;
  try {
    const res = await fetch(`${ISSUER}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    userinfo.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e?.message || 'userinfo 调用失败');
  } finally {
    loadingUserinfo.value = false;
  }
}

function back() {
  router.push('/console');
}

onMounted(exchange);
</script>

<style scoped>
.callback-page {
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: #f5f7fa;
  padding: 40px 16px;
}
.box-card {
  width: 720px;
  max-width: 100%;
}
.json {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  overflow: auto;
  max-height: 320px;
}
.mb16 {
  margin-bottom: 16px;
}
.mt16 {
  margin-top: 16px;
}
.center {
  padding: 16px;
}
</style>
