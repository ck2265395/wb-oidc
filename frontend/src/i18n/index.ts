import { createI18n } from 'vue-i18n';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import common from './messages/common';
import consoleMsgs from './messages/console';
import developerMsgs from './messages/developer';

export type AppLocale = 'zh-CN' | 'en-US';

export const LOCALES: Array<{ value: AppLocale; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];

export const STORAGE_KEY = 'wb_oidc_locale';

/** element-plus 组件库语言包映射 */
export const EP_LOCALES: Record<AppLocale, typeof zhCn> = {
  'zh-CN': zhCn,
  'en-US': en,
};

function initialLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
  if (saved === 'zh-CN' || saved === 'en-US') return saved;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

/** 语言包按模块聚合：common（框架/登录/授权/回调）+ console + developer */
const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': {
      common: common.zhCN,
      console: consoleMsgs.zhCN,
      developer: developerMsgs.zhCN,
    },
    'en-US': {
      common: common.enUS,
      console: consoleMsgs.enUS,
      developer: developerMsgs.enUS,
    },
  },
});

/** 切换语言：持久化 + 同步 html lang + element-plus 组件语言（由 App.vue 响应式传入） */
export function switchLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export default i18n;
