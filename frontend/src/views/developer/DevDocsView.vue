<template>
  <div class="docs-wrap">
    <div class="docs-head">
      <h2 class="page-title">接入文档</h2>
      <p class="page-desc">
        标准授权码 + PKCE 流程，三步接入。所有端点均可在 Discovery 文档中自动发现。
      </p>
    </div>

    <el-row :gutter="20">
      <!-- 左侧目录 -->
      <el-col :span="5">
        <div class="toc">
          <div class="toc-title">目录</div>
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
          <h3 class="doc-title">🚀 快速接入指南</h3>
          <el-steps :active="4" align-center class="steps">
            <el-step title="提交应用申请" description="开发者门户 → 我的应用" />
            <el-step title="管理员审核" description="审核通过后应用生效" />
            <el-step title="发起授权" description="跳转 /auth 端点" />
            <el-step title="换取令牌" description="code → token 端点" />
          </el-steps>
        </div>

        <div class="doc-block" id="authorize">
          <h3 class="doc-title">1️⃣ 授权端点（浏览器跳转）</h3>
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
            title="SPA / 小程序必须使用 PKCE（S256）；机密应用建议后端走 client_secret_basic 换令牌。"
          />
        </div>

        <div class="doc-block" id="token">
          <h3 class="doc-title">2️⃣ 令牌端点（服务端调用）</h3>
          <pre class="code dark">POST {{ issuer }}/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code=AUTHORIZATION_CODE
redirect_uri=YOUR_REDIRECT_URI
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET        -- 机密应用
code_verifier=PKCE_VERIFIER             -- PKCE 应用</pre>
        </div>

        <div class="doc-block" id="userinfo">
          <h3 class="doc-title">3️⃣ 用户信息</h3>
          <pre class="code dark">GET {{ issuer }}/me
Authorization: Bearer ACCESS_TOKEN</pre>
          <p class="note">
            scope 对应 claims：<el-tag size="small" round>profile</el-tag> 昵称头像、<el-tag size="small" round>email</el-tag> 邮箱、<el-tag size="small" round>phone</el-tag> 手机号；用户数据来自平台老系统账号库（只读）。
          </p>
        </div>

        <div class="doc-block" id="endpoints">
          <h3 class="doc-title">📌 端点速查（Discovery）</h3>
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
// 同源部署：直接用当前 origin 作为 issuer
const issuer = window.location.origin;

const sections = [
  { id: 'guide', label: '快速接入指南' },
  { id: 'authorize', label: '授权端点' },
  { id: 'token', label: '令牌端点' },
  { id: 'userinfo', label: '用户信息' },
  { id: 'endpoints', label: '端点速查' },
];
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
