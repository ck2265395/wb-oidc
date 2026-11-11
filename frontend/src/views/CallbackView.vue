<template>
  <div class="callback-page">
    <el-card class="box-card">
      <template #header><span>🎉 {{ t('common.callback.title') }}</span></template>

      <div v-if="error">
        <el-result icon="error" :title="t('common.callback.errorTitle')" :sub-title="error" />
      </div>

      <div v-else-if="tokens">
        <el-descriptions :column="1" border class="mb16">
          <el-descriptions-item :label="t('common.callback.currentUser')">
            {{ idToken?.sub }}
          </el-descriptions-item>
          <el-descriptions-item v-if="idToken?.nickname || idToken?.name" :label="t('common.callback.nickname')">
            {{ idToken?.nickname || idToken?.name }}
          </el-descriptions-item>
          <el-descriptions-item v-if="idToken?.email" :label="t('common.callback.email')">
            {{ idToken?.email }}
          </el-descriptions-item>
        </el-descriptions>

        <el-collapse>
          <el-collapse-item :title="t('common.callback.tokenResponse')">
            <pre class="json">{{ JSON.stringify(tokens, null, 2) }}</pre>
          </el-collapse-item>
          <el-collapse-item :title="t('common.callback.idTokenDecoded')">
            <pre class="json">{{ JSON.stringify(idToken, null, 2) }}</pre>
          </el-collapse-item>
          <el-collapse-item v-if="userinfo" :title="t('common.callback.userinfoResp')">
            <pre class="json">{{ JSON.stringify(userinfo, null, 2) }}</pre>
          </el-collapse-item>
        </el-collapse>

        <div class="mt16">
          <el-button type="primary" :loading="loadingUserinfo" @click="fetchUserinfo">
            {{ t('common.callback.fetchUserinfo') }}
          </el-button>
          <el-button @click="back">{{ t('common.callback.back') }}</el-button>
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
import { useI18n } from 'vue-i18n';
import { ISSUER, decodeJwtPayload } from '../api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const error = ref('');
const tokens = ref<Record<string, unknown> | null>(null);
const userinfo = ref<Record<string, unknown> | null>(null);
const loadingUserinfo = ref(false);

const idToken = computed(() => {
  const tk = tokens.value?.id_token;
  return typeof tk === 'string' ? decodeJwtPayload(tk) : null;
});

async function exchange() {
  const stored = sessionStorage.getItem('wb_oidc_pkce');
  if (!stored) {
    error.value = t('common.callback.noContext');
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
    error.value = t('common.callback.noCode');
    return;
  }
  if (returnedState !== state) {
    error.value = t('common.callback.stateMismatch');
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
      error.value = t('common.callback.tokenEndpointError', {
        err: `${json.error} - ${json.error_description || ''}`,
      });
      return;
    }
    tokens.value = json;
    sessionStorage.removeItem('wb_oidc_pkce');
  } catch (e: any) {
    error.value = e?.message || t('common.callback.exchangeFailed');
  }
}

async function fetchUserinfo() {
  const accessToken = tokens.value?.access_token as string | undefined;
  if (!accessToken) {
    ElMessage.warning(t('common.callback.noAccessToken'));
    return;
  }
  loadingUserinfo.value = true;
  try {
    const res = await fetch(`${ISSUER}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    userinfo.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.callback.userinfoFailed'));
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
  background: var(--canvas);
  padding: 40px 16px;
}
.box-card {
  width: 720px;
  max-width: 100%;
}
.json {
  background: var(--canvas);
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
