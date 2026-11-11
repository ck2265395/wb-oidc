<template>
  <div class="docs-wrap">
    <div class="docs-head">
      <h2 class="page-title">{{ t('developer.nav.docs') }}</h2>
      <p class="page-desc">
        {{ t('developer.docs.desc') }}
      </p>
    </div>

    <el-row :gutter="20">
      <!-- 左侧目录 -->
      <el-col :span="5">
        <div class="toc">
          <div class="toc-title">{{ t('developer.docs.toc') }}</div>
          <a
            v-for="s in sections"
            :key="s.id"
            :href="`#${s.id}`"
            class="toc-item"
          >
            {{ s.label }}
          </a>
        </div>
      </el-col>

      <!-- 右侧内容 -->
      <el-col :span="19">
        <div class="doc-block" id="guide">
          <h3 class="doc-title">{{ t('developer.docs.guideTitle') }}</h3>
          <el-steps :active="5" align-center class="steps">
            <el-step :title="t('developer.docs.step1Title')" :description="t('developer.docs.step1Desc')" />
            <el-step :title="t('developer.docs.step2Title')" :description="t('developer.docs.step2Desc')" />
            <el-step :title="t('developer.docs.step3Title')" :description="t('developer.docs.step3Desc')" />
            <el-step :title="t('developer.docs.step4Title')" :description="t('developer.docs.step4Desc')" />
            <el-step :title="t('developer.docs.step5Title')" description="/auth → code → token" />
          </el-steps>
        </div>

        <div class="doc-block" id="app-types">
          <h3 class="doc-title">{{ t('developer.docs.appTypesTitle') }}</h3>
          <el-table :data="appTypes" size="small" border>
            <el-table-column prop="cat" :label="t('developer.docs.thCategory')" width="110" />
            <el-table-column prop="auth" :label="t('developer.docs.thAuthMethod')" min-width="170" />
            <el-table-column prop="secret" :label="t('developer.docs.thSecret')" min-width="130" />
            <el-table-column prop="pkce" :label="t('developer.docs.thPkce')" min-width="140" />
          </el-table>
          <p class="note">{{ t('developer.docs.appTypesNote') }}</p>
          <el-alert
            type="info"
            :closable="false"
            class="mt"
            :title="t('developer.docs.secretSecurityNote')"
          />
        </div>

        <div class="doc-block" id="authorize">
          <h3 class="doc-title">{{ t('developer.docs.authorizeTitle') }}</h3>
          <pre class="code dark">GET {{ issuer }}/auth?client_id=YOUR_CLIENT_ID
  &amp;response_type=code
  &amp;scope=openid profile email
  &amp;redirect_uri=YOUR_REDIRECT_URI
  &amp;state=RANDOM_STATE
  &amp;code_challenge=PKCE_CHALLENGE
  &amp;code_challenge_method=S256</pre>
          <el-alert
            type="info"
            :closable="false"
            :title="t('developer.docs.pkceNote')"
          />
          <h4 class="sub-title">{{ t('developer.docs.authorizeParamsTitle') }}</h4>
          <el-table :data="authParams" size="small" border>
            <el-table-column prop="param" :label="t('developer.docs.thParam')" min-width="200" />
            <el-table-column prop="req" :label="t('developer.docs.thRequired')" width="90" />
            <el-table-column prop="desc" :label="t('developer.docs.thDesc')" min-width="260" />
          </el-table>
        </div>

        <div class="doc-block" id="token">
          <h3 class="doc-title">{{ t('developer.docs.tokenTitle') }}</h3>
          <pre class="code dark">POST {{ issuer }}/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code=AUTHORIZATION_CODE
redirect_uri=YOUR_REDIRECT_URI
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET        {{ t('developer.docs.secretAppComment') }}
code_verifier=PKCE_VERIFIER             {{ t('developer.docs.pkceAppComment') }}</pre>
        </div>

        <div class="doc-block" id="refresh">
          <h3 class="doc-title">{{ t('developer.docs.refreshTitle') }}</h3>
          <pre class="code dark">POST {{ issuer }}/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
refresh_token=REFRESH_TOKEN
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET        {{ t('developer.docs.secretAppComment') }}</pre>
          <el-alert
            type="info"
            :closable="false"
            :title="t('developer.docs.refreshNote')"
          />
        </div>

        <div class="doc-block" id="userinfo">
          <h3 class="doc-title">{{ t('developer.docs.userinfoTitle') }}</h3>
          <pre class="code dark">GET {{ issuer }}/me
Authorization: Bearer ACCESS_TOKEN</pre>
          <p class="note">
            {{ t('developer.docs.claimsNote') }}
          </p>
        </div>

        <div class="doc-block" id="session">
          <h3 class="doc-title">{{ t('developer.docs.sessionTitle') }}</h3>
          <pre class="code dark">GET {{ issuer }}/session/end
  ?id_token_hint=ID_TOKEN
  &amp;post_logout_redirect_uri=https://your-app.com/logged-out
  &amp;state=RANDOM_STATE</pre>
          <p class="note">{{ t('developer.docs.sessionNote') }}</p>
        </div>

        <div class="doc-block" id="manage">
          <h3 class="doc-title">{{ t('developer.docs.manageTitle') }}</h3>
          <pre class="code dark">POST {{ issuer }}/token/introspection
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

token=ACCESS_TOKEN
---
{ "active": true, "scope": "openid profile email",
  "sub": "...", "exp": 1730000000 }</pre>
          <pre class="code dark">POST {{ issuer }}/token/revocation
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

token=REFRESH_TOKEN</pre>
          <p class="note">{{ t('developer.docs.introspectNote') }}</p>
          <p class="note">{{ t('developer.docs.revocationNote') }}</p>
        </div>

        <div class="doc-block" id="scopes">
          <h3 class="doc-title">{{ t('developer.docs.claimsTitle') }}</h3>
          <el-table :data="scopeClaims" size="small" border>
            <el-table-column prop="scope" :label="t('developer.docs.thScope')" width="150" />
            <el-table-column prop="claims" :label="t('developer.docs.thClaims')" min-width="200" />
            <el-table-column prop="desc" :label="t('developer.docs.thDesc')" min-width="220" />
          </el-table>
        </div>

        <div class="doc-block" id="ttl">
          <h3 class="doc-title">{{ t('developer.docs.ttlTitle') }}</h3>
          <el-table :data="ttlRows" size="small" border>
            <el-table-column prop="token" :label="t('developer.docs.thToken')" min-width="180" />
            <el-table-column prop="ttl" :label="t('developer.docs.thTtl')" width="110" />
            <el-table-column prop="note" :label="t('developer.docs.thTtlNote')" min-width="220" />
          </el-table>
        </div>

        <div class="doc-block" id="endpoints">
          <h3 class="doc-title">{{ t('developer.docs.endpointsTitle') }}</h3>
          <el-table :data="endpointRows" size="small" border>
            <el-table-column prop="name" :label="t('developer.docs.thUse')" min-width="140" />
            <el-table-column prop="method" :label="t('developer.docs.thMethod')" width="110" />
            <el-table-column prop="path" :label="t('developer.docs.thPath')" min-width="320" />
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// 同源部署：直接用当前 origin 作为 issuer
const issuer = window.location.origin;

const { t } = useI18n();
const sections = computed(() => [
  { id: 'guide', label: t('developer.docs.secGuide') },
  { id: 'app-types', label: t('developer.docs.secAppTypes') },
  { id: 'authorize', label: t('developer.docs.secAuthorize') },
  { id: 'token', label: t('developer.docs.secToken') },
  { id: 'refresh', label: t('developer.docs.secRefresh') },
  { id: 'userinfo', label: t('developer.docs.secUserinfo') },
  { id: 'session', label: t('developer.docs.secSession') },
  { id: 'manage', label: t('developer.docs.secManage') },
  { id: 'scopes', label: t('developer.docs.secScopes') },
  { id: 'ttl', label: t('developer.docs.secTtl') },
  { id: 'endpoints', label: t('developer.docs.secEndpoints') },
]);

const appTypes = computed(() => [
  {
    cat: t('developer.apps.catWeb'),
    auth: 'client_secret_basic',
    secret: t('developer.docs.secretHas'),
    pkce: t('developer.docs.pkceOpt'),
  },
  {
    cat: t('developer.apps.catMobile'),
    auth: 'none',
    secret: t('developer.docs.secretNone'),
    pkce: t('developer.docs.pkceReq'),
  },
  {
    cat: t('developer.apps.catMini'),
    auth: 'none',
    secret: t('developer.docs.secretNone'),
    pkce: t('developer.docs.pkceReq'),
  },
]);

const authParams = computed(() => [
  { param: 'client_id', req: t('developer.docs.reqYes'), desc: t('developer.docs.pClientId') },
  { param: 'response_type', req: t('developer.docs.reqYes'), desc: t('developer.docs.pResponseType') },
  { param: 'redirect_uri', req: t('developer.docs.reqYes'), desc: t('developer.docs.pRedirectUri') },
  { param: 'scope', req: t('developer.docs.reqYes'), desc: t('developer.docs.pScope') },
  { param: 'state', req: t('developer.docs.reqRec'), desc: t('developer.docs.pState') },
  { param: 'code_challenge / code_challenge_method', req: t('developer.docs.reqCond'), desc: t('developer.docs.pCodeChallenge') },
]);

const scopeClaims = computed(() => [
  { scope: 'openid', claims: 'sub', desc: t('developer.docs.claimsOpenid') },
  { scope: 'profile', claims: 'name, nickname, picture', desc: t('developer.docs.claimsProfile') },
  { scope: 'email', claims: 'email, email_verified', desc: t('developer.docs.claimsEmail') },
  { scope: 'phone', claims: 'phone_number', desc: t('developer.docs.claimsPhone') },
  { scope: 'offline_access', claims: 'refresh_token', desc: t('developer.docs.claimsOffline') },
]);

const ttlRows = computed(() => [
  { token: t('developer.docs.ttlCode'), ttl: '10 min', note: t('developer.docs.ttlCodeNote') },
  { token: 'access_token / id_token', ttl: '1 h', note: t('developer.docs.ttlAccessNote') },
  { token: 'refresh_token', ttl: '30 d', note: t('developer.docs.ttlRefreshNote') },
  { token: t('developer.docs.ttlSession'), ttl: '14 d', note: t('developer.docs.ttlSessionNote') },
]);

const endpointRows = computed(() => [
  { name: 'Discovery', method: 'GET', path: `${issuer}/.well-known/openid-configuration` },
  { name: 'JWKS', method: 'GET', path: `${issuer}/jwks` },
  { name: 'authorize', method: 'GET', path: `${issuer}/auth` },
  { name: 'token', method: 'POST', path: `${issuer}/token` },
  { name: 'userinfo', method: 'GET / POST', path: `${issuer}/userinfo` },
  { name: 'end_session', method: 'GET', path: `${issuer}/session/end` },
  { name: 'introspection', method: 'POST', path: `${issuer}/token/introspection` },
  { name: 'revocation', method: 'POST', path: `${issuer}/token/revocation` },
]);
</script>

<style scoped>
.docs-wrap {
  max-width: 1440px;
  margin: 0 auto;
  padding: 40px 40px 64px;
}
.docs-head {
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
.toc {
  position: sticky;
  top: 88px;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 16px;
}
.toc-title {
  font-size: 12px;
  font-weight: 700;
  color: #9ca3af;
  letter-spacing: 1px;
  margin-bottom: 10px;
}
.toc-item {
  display: block;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: #4b5563;
  text-decoration: none;
  transition: all 0.15s;
}
.toc-item:hover {
  color: #0b57d0;
  background: #ecf3fd;
}
.doc-block {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 20px;
  scroll-margin-top: 88px;
}
.doc-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}
.sub-title {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}
.steps {
  margin-top: 8px;
}
.code.dark {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  padding: 16px 18px;
  font-size: 12.5px;
  line-height: 1.8;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 14px;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
}
.note {
  font-size: 13px;
  color: #6b7280;
  margin: 10px 0 0;
}
.mt {
  margin-top: 10px;
}
</style>
