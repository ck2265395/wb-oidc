<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <el-tag effect="dark" round class="hero-badge" size="small">
          OpenID Connect 标准协议
        </el-tag>
        <h1 class="hero-title">
          一次接入，触达
          <span class="grad">全平台存量用户</span>
        </h1>
        <p class="hero-desc">
          让你的应用接入 WB 统一身份认证：用户用现有账号一键登录，
          无需重新注册。标准 OIDC 授权码 + PKCE，机密应用与 SPA / 小程序全支持。
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" round class="cta" @click="goStart">
            {{ developer ? '进入我的应用' : '立即接入' }}
          </el-button>
          <el-button size="large" round class="cta-ghost" @click="$router.push('/docs')">
            查看接入文档
          </el-button>
        </div>
        <div class="hero-meta">
          <span>🔐 回调白名单严格校验</span>
          <span>⚡ 应用审核平均 1 个工作日</span>
          <span>🧩 RS256 签名 + JWKS 自动发现</span>
        </div>
      </div>
    </section>

    <!-- 特性 -->
    <section class="features">
      <div class="section-inner">
        <h2 class="section-title">为什么选择 WB 开放平台</h2>
        <el-row :gutter="20">
          <el-col :span="6" v-for="f in features" :key="f.title">
            <div class="feature-card">
              <div class="feature-icon">{{ f.icon }}</div>
              <div class="feature-title">{{ f.title }}</div>
              <div class="feature-desc">{{ f.desc }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
    </section>

    <!-- 接入流程 -->
    <section class="flow">
      <div class="section-inner">
        <h2 class="section-title">四步完成接入</h2>
        <el-row :gutter="20">
          <el-col :span="6" v-for="(s, i) in steps" :key="s.title">
            <div class="step-card">
              <div class="step-num">0{{ i + 1 }}</div>
              <div class="step-title">{{ s.title }}</div>
              <div class="step-desc">{{ s.desc }}</div>
            </div>
          </el-col>
        </el-row>
        <div class="flow-cta">
          <el-button type="primary" round size="large" @click="goStart">
            {{ developer ? '管理我的应用' : '注册开发者账号' }}
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getCurrentDeveloper } from '../../api/dev';

const router = useRouter();
const developer = computed(() => getCurrentDeveloper());

function goStart() {
  router.push(developer.value ? '/apps' : '/developer/login?tab=register');
}

const features = [
  { icon: '🛡️', title: '标准协议', desc: '完整实现 OpenID Connect 1.0，主流 OIDC 客户端库开箱即用，杜绝私有协议锁定。' },
  { icon: '👥', title: '存量用户直连', desc: '用户数据来自平台既有账号体系，你的用户无需重新注册，登录转化零损耗。' },
  { icon: '🔍', title: '审核机制', desc: '开发者实名注册 + 应用审核双重把关，回调地址白名单严格校验，杜绝开放重定向。' },
  { icon: '🔑', title: '安全默认', desc: '默认授权码 + PKCE，RS256 签名，refresh token 轮换，密钥可随时吊销重置。' },
];

const steps = [
  { title: '注册开发者', desc: '邮箱注册，填写公司与联系方式，等待审核通过。' },
  { title: '提交应用', desc: '填写应用名称、回调地址与所需 scope，提交审核。' },
  { title: '集成登录', desc: '按文档发起 /auth 授权跳转，用 code 换取 token。' },
  { title: '上线运营', desc: '审核通过即可上线，回调与权限变更需重新审核。' },
];
</script>

<style scoped>
.home {
  background: #fff;
}
.hero {
  background:
    radial-gradient(1000px 420px at 80% -10%, rgba(124, 58, 237, 0.18), transparent 60%),
    radial-gradient(900px 420px at 10% -10%, rgba(79, 70, 229, 0.22), transparent 60%),
    linear-gradient(180deg, #f5f6ff 0%, #ffffff 100%);
  padding: 96px 0 72px;
}
.hero-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
  text-align: center;
}
.hero-badge {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  letter-spacing: 1px;
}
.hero-title {
  margin: 20px 0 16px;
  font-size: 44px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.5px;
}
.grad {
  background: linear-gradient(135deg, #4f46e5, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-desc {
  max-width: 640px;
  margin: 0 auto;
  font-size: 16px;
  line-height: 1.8;
  color: #6b7280;
}
.hero-actions {
  margin-top: 32px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
.cta {
  padding-left: 28px;
  padding-right: 28px;
}
.cta-ghost {
  padding-left: 28px;
  padding-right: 28px;
}
.hero-meta {
  margin-top: 28px;
  display: flex;
  justify-content: center;
  gap: 28px;
  font-size: 13px;
  color: #9ca3af;
  flex-wrap: wrap;
}
.section-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 64px 24px;
}
.features {
  border-top: 1px solid #f3f4f6;
}
.section-title {
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 36px;
}
.feature-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 26px 22px;
  height: 100%;
  transition: all 0.25s;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(79, 70, 229, 0.1);
  border-color: #e0e7ff;
}
.feature-icon {
  font-size: 28px;
  margin-bottom: 12px;
}
.feature-title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8px;
}
.feature-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #6b7280;
}
.flow {
  background: #f7f8fb;
  border-top: 1px solid #f3f4f6;
}
.step-card {
  position: relative;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 24px 22px;
  height: 100%;
}
.step-num {
  font-size: 30px;
  font-weight: 800;
  background: linear-gradient(135deg, #4f46e5, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 8px;
}
.step-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 6px;
}
.step-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #6b7280;
}
.flow-cta {
  text-align: center;
  margin-top: 40px;
}
</style>
