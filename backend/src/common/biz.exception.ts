import { HttpException } from '@nestjs/common';
import { ErrorCodeDef, LocalizedMessage } from './error-code';

/**
 * 业务异常：携带统一错误码（1MMXX），由全局异常过滤器按请求语言（language 头）生成 {code, message} 信封。
 * 语言解析统一在过滤器完成，抛错点不需要关心请求语言。
 *
 * 用法：
 *   throw new BizException(ERROR_CODE.APP_NOT_FOUND);
 *   // 覆盖文案：纯中文动态串（en-US 时回退错误码默认英文文案）
 *   throw new BizException(ERROR_CODE.APP_NOT_FOUND, `应用 ${clientId} 不存在`);
 *   // 覆盖文案：双语对象（两种语言都精确控制）
 *   throw new BizException(ERROR_CODE.PARAM_INVALID, { zhCN: '应用名称必填', enUS: 'App name is required' });
 *   // 附加数据
 *   throw new BizException(ERROR_CODE.PARAM_INVALID, '字段非法', { fields: [...] });
 */
export class BizException extends HttpException {
  readonly bizCode: number;
  /** 抛错时覆盖的文案；undefined 时用错误码默认文案 */
  readonly bizMessage?: LocalizedMessage | string;
  readonly bizData: unknown;

  constructor(def: ErrorCodeDef, message?: LocalizedMessage | string, data?: unknown) {
    super(
      typeof message === 'string' ? message : message ? message.zhCN : def.message.zhCN,
      def.httpStatus,
    );
    this.bizCode = def.code;
    this.bizMessage = message;
    this.bizData = data;
  }
}
