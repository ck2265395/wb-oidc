<template>
  <div class="docs">
    <el-card>
      <template #header>🚀 快速接入指南（OIDC 授权码 + PKCE）</template>
      <el-steps :active="4" align-center>
        <el-step title="提交应用申请" description="开发者门户 → 我的应用" />
        <el-step title="管理员审核" description="审核通过后应用生效" />
        <el-step title="发起授权" description="跳转 /auth 端点" />
        <el-step title="换取令牌" description="code → token 端点" />
      </el-steps>
    </el-card>

    <el-card class="mt16">
      <template #header>1️⃣ 授权端点（浏览器跳转）</template>
      <pre class="code">GET {{ issuer }}/auth?client_id=YOUR_CLIENT_ID
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
    </el-card>

    <el-card class="mt16">
      <template #header>2️⃣ 令牌端点（服务端调用）</template>
      <pre class="code">POST {{ issuer }}/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code=AUTHORIZATION_CODE
redirect_uri=YOUR_REDIRECT_URI
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET        -- 机密应用
code_verifier=PKCE_VERIFIER             -- PKCE 应用</pre>
    </el-card>

    <el-card class="mt16">
      <template #header>3️⃣ 用户信息</template>
      <pre class="code">GET {{ issuer }}/me
Authorization: Bearer ACCESS_TOKEN</pre>
      <p class="note">scope 对应 claims：<el-tag size="small">profile</el-tag> 昵称头像、<el-tag size="small">email</el-tag> 邮箱、<el-tag size="small">phone</el-tag> 手机号；用户数据来自平台老系统账号库（只读）。</p>
    </el-card>

    <el-card class="mt16">
      <template #header>📌 端点速查（Discovery）</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="Discovery">{{ issuer }}/.well-known/openid-configuration</el-descriptions-item>
        <el-descriptions-item label="JWKS">{{ issuer }}/jwks</el-descriptions-item>
        <el-descriptions-item label="authorize">{{ issuer }}/auth</el-descriptions-item>
        <el-descriptions-item label="token">{{ issuer }}/token</el-descriptions-item>
        <el-descriptions-item label="userinfo">{{ issuer }}/me</el-descriptions-item>
        <el-descriptions-item label="end_session">{{ issuer }}/session/end</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// 同源部署：直接用当前 origin 作为 issuer
const issuer = window.location.origin;
</script>

<style scoped>
.mt16 {
  margin-top: 16px;
}
.code {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.7;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.note {
  font-size: 13px;
  color: #606266;
}
</style>
