import { ref, computed } from 'vue';

/**
 * 主题系统：暗色模式 + 运行时主色切换。
 * - 暗色：html.dark 类 + element-plus dark css-vars；'auto' 跟随系统
 * - 主色：写入 --el-color-primary 系列 CSS 变量（element-plus 全组件生效），
 *   并同步 --brand-600/700/800 供页面自定义样式引用
 * 全部持久化 localStorage，启动时恢复。
 */
export type DarkMode = 'light' | 'dark' | 'auto';

export interface ThemePreset {
  key: string;
  color: string;
  name: string;
  nameEn: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: 'blue', color: '#0b57d0', name: '商务蓝', nameEn: 'Blue' },
  { key: 'turquoise', color: '#1abc9c', name: '青碧', nameEn: 'Turquoise' },
  { key: 'violet', color: '#6b4fd8', name: '雅紫', nameEn: 'Violet' },
  { key: 'rose', color: '#d63384', name: '玫红', nameEn: 'Rose' },
  { key: 'orange', color: '#e8590c', name: '暖橙', nameEn: 'Orange' },
  { key: 'cyan', color: '#0b8cad', name: '湖青', nameEn: 'Cyan' },
];

const DARK_KEY = 'wb_oidc_dark_mode';
const COLOR_KEY = 'wb_oidc_theme_color';

function initialDark(): DarkMode {
  const saved = localStorage.getItem(DARK_KEY) as DarkMode | null;
  return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
}

function initialColor(): string {
  return localStorage.getItem(COLOR_KEY) || THEME_PRESETS[0].color;
}

const darkMode = ref<DarkMode>(initialDark());
const primaryColor = ref(initialColor());
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  systemDark.value = e.matches;
});

const isDark = computed(
  () => darkMode.value === 'dark' || (darkMode.value === 'auto' && systemDark.value),
);

/** 16 进制 → rgb */
function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** rgb → 16 进制 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** 与另一颜色按比例混合（ratio 为另一方占比） */
function mix(hex: string, other: [number, number, number], ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [or, og, ob] = other;
  return rgbToHex(
    r + (or - r) * ratio,
    g + (og - g) * ratio,
    b + (ob - b) * ratio,
  );
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/** 生成 element-plus 主色梯度（light-3/5/7/8/9、dark-2） */
function primaryGradient(hex: string): Record<string, string> {
  return {
    '--el-color-primary': hex,
    '--el-color-primary-light-3': mix(hex, WHITE, 0.3),
    '--el-color-primary-light-5': mix(hex, WHITE, 0.5),
    '--el-color-primary-light-7': mix(hex, WHITE, 0.7),
    '--el-color-primary-light-8': mix(hex, WHITE, 0.8),
    '--el-color-primary-light-9': mix(hex, WHITE, 0.9),
    '--el-color-primary-dark-2': mix(hex, BLACK, 0.2),
  };
}

/** 应用主题到 <html> */
function applyTheme(): void {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark.value);
  // 主色梯度（浅色语义）；暗色下 element-plus dark css-vars 会用同一套变量名，
  // 这里写入行内样式保证切换即时生效
  const grad = primaryGradient(primaryColor.value);
  for (const [k, v] of Object.entries(grad)) root.style.setProperty(k, v);
  // 页面自定义样式引用的 brand 变量同步
  root.style.setProperty('--brand-600', primaryColor.value);
  root.style.setProperty('--brand-700', mix(primaryColor.value, BLACK, 0.12));
  root.style.setProperty('--brand-800', mix(primaryColor.value, BLACK, 0.24));
  root.style.setProperty('--brand-500', mix(primaryColor.value, WHITE, 0.08));
  // 侧边栏整体深底：主色沉入深底（类似 antd #001529 的深藏青观感，跟随皮肤）
  root.style.setProperty('--aside-bg', mix(primaryColor.value, BLACK, 0.85));
  const [ar, ag, ab] = hexToRgb(primaryColor.value);
  root.style.setProperty('--aside-active', `rgba(${ar}, ${ag}, ${ab}, 0.55)`);
}

function setDarkMode(mode: DarkMode): void {
  darkMode.value = mode;
  localStorage.setItem(DARK_KEY, mode);
  applyTheme();
}

function setPrimaryColor(color: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
  primaryColor.value = color.toLowerCase();
  localStorage.setItem(COLOR_KEY, primaryColor.value);
  applyTheme();
}

// 启动即应用一次
applyTheme();

export function useTheme() {
  return {
    darkMode,
    isDark,
    primaryColor,
    setDarkMode,
    setPrimaryColor,
  };
}
