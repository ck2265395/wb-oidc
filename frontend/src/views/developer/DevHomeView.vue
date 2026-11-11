<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <span class="badge-dot" />
          Moondrop OpenID Connect
        </div>
        <h1 class="hero-title">
          {{ t('developer.home.heroTitle1') }}<br />
          <span class="accent">{{ t('developer.home.heroTitle2') }}</span>
        </h1>
        <p class="hero-desc">
          {{ t('developer.home.heroDesc') }}
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" class="cta" @click="goStart">
            {{ developer ? t('developer.home.enterWorkspace') : t('developer.home.getStarted') }}
          </el-button>
          <el-button size="large" class="cta-ghost" @click="$router.push('/docs')">
            {{ t('developer.common.viewDocs') }}
          </el-button>
        </div>
        <div class="hero-meta">
          <span><i />{{ t('developer.home.metaAllowlist') }}</span>
          <span><i />{{ t('developer.home.metaReviewFast') }}</span>
          <span><i />{{ t('developer.home.metaSecurity') }}</span>
        </div>
      </div>
    </section>

    <!-- 特性 -->
    <section class="features">
      <div class="section-inner">
        <div class="section-eyebrow">{{ t('developer.home.eyebrowFeatures') }}</div>
        <h2 class="section-title">{{ t('developer.home.featuresTitle') }}</h2>
        <el-row :gutter="20" class="feature-row">
          <el-col :span="6" v-for="f in features" :key="f.title">
            <div class="feature-card">
              <div class="feature-icon"><DevFeatureIcon :name="f.icon" /></div>
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
        <div class="section-eyebrow">{{ t('developer.home.eyebrowFlow') }}</div>
        <h2 class="section-title">{{ t('developer.home.flowTitle') }}</h2>
        <el-row :gutter="20" class="flow-row">
          <el-col :span="6" v-for="(s, i) in steps" :key="s.title">
            <div class="step-card">
              <div class="step-num">0{{ i + 1 }}</div>
              <div class="step-title">{{ s.title }}</div>
              <div class="step-desc">{{ s.desc }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
    </section>

    <!-- 独立 CTA 横条：与上方卡片彻底分离，避免被卡片层叠遮挡 -->
    <section class="cta-band">
      <div class="cta-inner">
        <div class="cta-copy">
          <h3>{{ t('developer.home.ctaTitle') }}</h3>
          <p>{{ t('developer.home.ctaDesc') }}</p>
        </div>
        <div class="cta-action">
          <el-button size="large" class="cta-on-dark" @click="goStart">
            {{ developer ? t('developer.home.enterWorkspace') : t('developer.home.registerFree') }}
          </el-button>
          <el-button size="large" class="cta-on-dark-ghost" @click="$router.push('/docs')">
            {{ t('developer.home.readDocs') }}
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getCurrentDeveloper } from '../../api/dev';
import DevFeatureIcon from './DevFeatureIcon.vue';

const { t } = useI18n();
const router = useRouter();
const developer = computed(() => getCurrentDeveloper());

function goStart() {
  router.push(developer.value ? '/apps' : '/developer/login?tab=register');
}

const features = computed(() => [
  { icon: 'protocol', title: t('developer.home.features.protocol.title'), desc: t('developer.home.features.protocol.desc') },
  { icon: 'users', title: t('developer.home.features.users.title'), desc: t('developer.home.features.users.desc') },
  { icon: 'review', title: t('developer.home.features.review.title'), desc: t('developer.home.features.review.desc') },
  { icon: 'security', title: t('developer.home.features.security.title'), desc: t('developer.home.features.security.desc') },
]);

const steps = computed(() => [
  { title: t('developer.home.steps.register.title'), desc: t('developer.home.steps.register.desc') },
  { title: t('developer.home.steps.newApp.title'), desc: t('developer.home.steps.newApp.desc') },
  { title: t('developer.home.steps.submitApp.title'), desc: t('developer.home.steps.submitApp.desc') },
  { title: t('developer.home.steps.launch.title'), desc: t('developer.home.steps.launch.desc') },
]);
</script>

<style scoped>
.home {
  /* 视口高于内容时，让深蓝 CTA 横条自然延伸到底部页脚，不留浅灰断层 */
  min-height: calc(100vh - 136px);
  display: flex;
  flex-direction: column;
  background: #061a3a;
}

/* ---------- Hero ---------- */
.hero {
  position: relative;
  background:
    radial-gradient(900px 420px at 82% -12%, rgba(11, 87, 208, 0.1), transparent 62%),
    radial-gradient(760px 380px at 12% -8%, rgba(10, 61, 145, 0.08), transparent 62%),
    linear-gradient(180deg, #f2f7ff 0%, #ffffff 100%);
  padding: 92px 0 76px;
  border-bottom: 1px solid #e8eef7;
}
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(11, 87, 208, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(11, 87, 208, 0.035) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent 80%);
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent 80%);
}
.hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
  text-align: center;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: 1px solid #cddffb;
  border-radius: 999px;
  background: #fff;
  color: #0a3d91;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  box-shadow: 0 2px 10px rgba(10, 61, 145, 0.06);
}
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0b57d0;
}
.hero-title {
  margin: 24px 0 18px;
  font-size: 46px;
  line-height: 1.28;
  font-weight: 800;
  color: #0b1220;
  letter-spacing: -1px;
}
.accent {
  color: #0b57d0;
}
.hero-desc {
  max-width: 660px;
  margin: 0 auto;
  font-size: 16px;
  line-height: 1.85;
  color: #4b5563;
}
.hero-actions {
  margin-top: 34px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
.cta,
.cta-ghost {
  padding-left: 30px;
  padding-right: 30px;
  font-weight: 600;
}
.cta-ghost {
  color: #0a3d91;
  border-color: #cddffb;
  background: #fff;
}
.hero-meta {
  margin-top: 34px;
  display: flex;
  justify-content: center;
  gap: 30px;
  font-size: 13px;
  color: #6b7280;
  flex-wrap: wrap;
}
.hero-meta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.hero-meta i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #0b57d0;
  display: inline-block;
}

/* ---------- 通用区块 ---------- */
.section-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 66px 24px;
}
.section-eyebrow {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #0b57d0;
  margin-bottom: 12px;
}
.section-title {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #0b1220;
  margin: 0 0 40px;
}
.features {
  background: #fff;
}
.feature-card,
.step-card {
  background: #fff;
  border: 1px solid #e3eaf3;
  border-radius: 10px;
  padding: 26px 22px;
  height: 100%;
  box-sizing: border-box;
  transition: transform 0.24s, box-shadow 0.24s, border-color 0.24s;
}
.feature-card:hover,
.step-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(10, 61, 145, 0.09);
  border-color: #bcd3f5;
}
.feature-icon {
  width: 48px;
  height: 48px;
  padding: 11px;
  box-sizing: border-box;
  margin-bottom: 20px;
  border: 1px solid #e3eaf3;
  border-radius: 10px;
  background: #f7faff;
  color: #0a3d91;
  transition: border-color 0.24s, background 0.24s, color 0.24s;
}
.feature-card:hover .feature-icon {
  border-color: #bcd3f5;
  background: #eaf2ff;
  color: #0b57d0;
}
.feature-title,
.step-title {
  font-size: 16px;
  font-weight: 700;
  color: #0b1220;
  margin-bottom: 8px;
}
.feature-desc,
.step-desc {
  font-size: 13px;
  line-height: 1.75;
  color: #6b7280;
}

/* ---------- 流程区 ---------- */
.flow {
  background: #f6f9fd;
  border-top: 1px solid #e8eef7;
  position: relative;
}
.flow-row,
.feature-row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
}
.step-card {
  position: relative;
  overflow: hidden;
}
.step-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: #0b57d0;
  opacity: 0.85;
}
.step-num {
  font-size: 30px;
  font-weight: 800;
  color: #0b57d0;
  margin-bottom: 10px;
  letter-spacing: -1px;
}

/* ---------- CTA 横条（独立层叠上下文，杜绝被卡片遮挡） ---------- */
.cta-band {
  position: relative;
  z-index: 2;
  clear: both;
  display: flex;
  align-items: center;
  flex: 1 0 auto;
  width: 100%;
  background: linear-gradient(110deg, #061a3a 0%, #0a3d91 100%);
  box-shadow: 0 -8px 28px rgba(6, 26, 58, 0.08);
}
.cta-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 44px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.cta-copy h3 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.cta-copy p {
  margin: 0;
  font-size: 14px;
  color: #c3d7f5;
}
.cta-action {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.cta-on-dark {
  background: #fff;
  border-color: #fff;
  color: #0a3d91;
  font-weight: 700;
  padding-left: 28px;
  padding-right: 28px;
}
.cta-on-dark:hover,
.cta-on-dark:focus {
  background: #eaf2ff;
  border-color: #eaf2ff;
  color: #082c66;
}
.cta-on-dark-ghost {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
  padding-left: 24px;
  padding-right: 24px;
}
.cta-on-dark-ghost:hover,
.cta-on-dark-ghost:focus {
  background: rgba(255, 255, 255, 0.12);
  border-color: #fff;
  color: #fff;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 34px;
  }
  .section-inner {
    padding: 48px 20px;
  }
  .cta-inner {
    padding: 36px 20px;
  }
}
</style>
