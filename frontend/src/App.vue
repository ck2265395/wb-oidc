<template>
  <el-config-provider :locale="epLocale">
    <router-view />
  </el-config-provider>

  <!-- 全局界面设置：语言 / 主色 / 暗色（门户页不用，门户在 Header 右侧提供语言+明暗切换） -->
  <el-popover
    v-if="!isPortal"
    placement="left-end"
    :width="264"
    trigger="click"
    popper-class="theme-popper"
  >
    <template #reference>
      <el-button class="settings-fab" circle size="large" :title="t('common.settings.title')">
        <el-icon :size="18"><Setting /></el-icon>
      </el-button>
    </template>
    <div class="settings-panel">
      <div class="settings-title">{{ t('common.settings.title') }}</div>

      <div class="settings-row">
        <span class="settings-label">{{ t('common.settings.language') }}</span>
        <el-select
          :model-value="locale"
          size="small"
          style="width: 130px"
          @change="(v: any) => switchLocale(v as any)"
        >
          <el-option v-for="l in LOCALES" :key="l.value" :label="l.label" :value="l.value" />
        </el-select>
      </div>

      <div class="settings-row">
        <span class="settings-label">{{ t('common.settings.themeColor') }}</span>
        <div class="swatches">
          <button
            v-for="p in THEME_PRESETS"
            :key="p.key"
            class="swatch"
            :class="{ active: primaryColor === p.color }"
            :style="{ background: p.color }"
            :title="locale === 'zh-CN' ? p.name : p.nameEn"
            @click="setPrimaryColor(p.color)"
          />
          <el-color-picker
            :model-value="primaryColor"
            size="small"
            @update:model-value="(v: string | null) => v && setPrimaryColor(v)"
          />
        </div>
      </div>

      <div class="settings-row">
        <span class="settings-label">{{ t('common.settings.darkMode') }}</span>
        <el-radio-group
          :model-value="darkMode"
          size="small"
          @update:model-value="(v: any) => setDarkMode(v as any)"
        >
          <el-radio-button value="light">
            <el-icon><Sunny /></el-icon>
          </el-radio-button>
          <el-radio-button value="auto">{{ t('common.settings.followSystem') }}</el-radio-button>
          <el-radio-button value="dark">
            <el-icon><Moon /></el-icon>
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Setting, Sunny, Moon } from '@element-plus/icons-vue';
import { LOCALES, switchLocale } from './i18n';
import { useTheme, THEME_PRESETS } from './composables/useTheme';
import { EP_LOCALES } from './i18n';

const { t, locale } = useI18n();
const { darkMode, primaryColor, setDarkMode, setPrimaryColor } = useTheme();
const route = useRoute();

// 门户页（开发者门户）不提供换肤，仅 Header 右侧语言+明暗切换
const isPortal = computed(() => !route.path.startsWith('/console') && !route.path.startsWith('/interaction') && !route.path.startsWith('/callback'));

// element-plus 组件库语言跟随当前 locale
const epLocale = computed(() => EP_LOCALES[locale.value as 'zh-CN' | 'en-US'] ?? EP_LOCALES['zh-CN']);
</script>

<style>
.settings-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2000;
}
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-title {
  font-weight: 600;
  font-size: 14px;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.settings-label {
  font-size: 13px;
  color: var(--ink-700);
}
.swatches {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.swatch.active {
  border-color: var(--ink-900);
  box-shadow: 0 0 0 2px var(--paper) inset;
}
</style>
