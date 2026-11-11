import { ERROR_CODE } from './error-code';

/** 模块分段定义（与 error-code.ts 注释保持一致） */
const MODULES: Array<{ prefix: string; title: string; range: string }> = [
  { prefix: '100', title: '通用 / 系统', range: '100xx' },
  { prefix: '101', title: '认证与会话', range: '101xx' },
  { prefix: '102', title: '开发者资格', range: '102xx' },
  { prefix: '103', title: '应用管理', range: '103xx' },
  { prefix: '104', title: 'OIDC 相关 REST API（预留）', range: '104xx' },
];

/**
 * 从 ERROR_CODE 生成 Markdown 错误码表（单一数据源，供 Swagger 描述与接入文档共用）。
 * 新增错误码只需在 ERROR_CODE 里加定义，此处自动收录。表格展示中文文案，英文文案见各码定义。
 */
export function buildErrorCodeDoc(): string {
  const entries = Object.entries(ERROR_CODE);
  const lines: string[] = [
    '## 统一响应与错误码',
    '',
    '所有接口返回 `{code, message, data}` 信封；`code=0` 表示成功，非 0 均为错误。',
    '错误码规则 `1MMXX`：1 固定开头，MM=模块号，XX=模块内错误号；每模块 x x00 为该模块兜底码。',
    '',
    '**多语言**：`message` 文案支持国际化，请求头 `language` 可选 `zh-CN`（默认）/ `en-US`；非法值回退 `zh-CN`。',
    '',
  ];

  for (const mod of MODULES) {
    const group: Array<[string, { code: number; httpStatus: number; message: { zhCN: string; enUS: string } }]> =
      entries.filter(([, def]) => String(def.code).startsWith(mod.prefix)) as never;
    if (!group.length) continue;
    lines.push(`### ${mod.title}（${mod.range}）`, '', '| 错误码 | HTTP | 含义（zh-CN） | Message (en-US) |', '|---|---|---|---|');
    for (const [, def] of group) {
      lines.push(`| ${def.code} | ${def.httpStatus} | ${def.message.zhCN} | ${def.message.enUS} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
