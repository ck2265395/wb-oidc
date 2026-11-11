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

        <div class="doc-block" id="userinfo">
          <h3 class="doc-title">{{ t('developer.docs.userinfoTitle') }}</h3>
          <pre class="code dark">GET {{ issuer }}/me
Authorization: Bearer ACCESS_TOKEN</pre>
          <p class="note">
            {{ t('developer.docs.scopeClaimsPrefix') }}<el-tag size="small" round>profile</el-tag>{{ t('developer.docs.claimProfile') }}<el-tag size="small" round>email</el-tag>{{ t('developer.docs.claimEmail') }}<el-tag size="small" round>phone</el-tag>{{ t('developer.docs.claimPhone') }}{{ t('developer.docs.claimsSource') }}
          </p>
        </div>

        <div class="doc-block" id="endpoints">
          <h3 class="doc-title">{{ t('developer.docs.endpointsTitle') }}</h3>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="Discovery">{{ issuer }}/.well-known/openid-configuration</el-descriptions-item>
            <el-descriptions-item label="JWKS">{{ issuer }}/jwks</el-descriptions-item>
            <el-descriptions-item label="authorize">{{ issuer }}/auth</el-descriptions-item>
            <el-descriptions-item label="token">{{ issuer }}/token</el-descriptions-item>
            <el-descriptions-item label="userinfo">{{ issuer }}/me</el-descriptions-item>
            <el-descriptions-item label="end_session">{{ issuer }}/session/end</el-descriptions-item>
          </el-descriptions>
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
  { id: 'authorize', label: t('developer.docs.secAuthorize') },
  { id: 'token', label: t('developer.docs.secToken') },
  { id: 'userinfo', label: t('developer.docs.secUserinfo') },
  { id: 'endpoints', label: t('developer.docs.secEndpoints') },
]);
</script>

<style scoped>
.docs-wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 64px;
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
  margin: 0;
}
</style>
