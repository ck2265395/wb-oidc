import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODE, ErrorCodeDef, pickLang, pickMessage } from './error-code';
import { BizException } from './biz.exception';

/** 按业务码反查错误码定义（用于 en-US 下动态中文串的英文兜底） */
function codeDef(code: number): ErrorCodeDef {
  const hit = Object.values(ERROR_CODE).find((d) => d.code === code);
  return hit ?? ERROR_CODE.SYSTEM_ERROR;
}

/** 统一响应信封：{code, message, data}，code=0 成功，1MMXX 为业务错误码 */
interface ErrorEnvelope {
  code: number;
  message: string;
  data: unknown;
}

/**
 * 全局异常过滤器：所有异常出口统一转 {code, message, data}，文案按请求头 language 国际化（zh-CN / en-US）。
 * - BizException        → 用其携带的业务码（抛错时的语言快照）
 * - ValidationPipe 400  → 10001，字段错误详情放 data
 * - 其他 HttpException  → 按状态码映射到 100xx 通用码
 * - 未捕获异常          → 10000 系统内部错误（日志记录原始中文，响应按语言）
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    // 请求语言：language 头优先，缺省回退 accept-language，最终兜底 zh-CN
    const lang = pickLang(
      (req.headers['language'] as string | undefined) ?? req.headers['accept-language'],
    );

    let envelope: ErrorEnvelope;

    if (exception instanceof BizException) {
      const override = exception.bizMessage;
      const message =
        typeof override === 'object' && override !== null
          ? pickMessage(override, lang)
          : override
            // 纯中文动态串：en-US 用错误码默认英文文案兜底
            ? (lang === 'en-US' ? pickMessage(codeDef(exception.bizCode).message, lang) : override)
            : pickMessage(codeDef(exception.bizCode).message, lang);
      envelope = { code: exception.bizCode, message, data: exception.bizData ?? null };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // ValidationPipe 产生的 {statusCode, message: Array<{field, message}>, error}
      const rawMessages = (body as { message?: unknown }).message;
      const validationMessages = Array.isArray(rawMessages) ? rawMessages : null;
      const formatMsg = (m: unknown): string =>
        typeof m === 'string'
          ? m
          : typeof m === 'object' && m !== null && 'field' in m && 'message' in m
            ? `${(m as { field: string }).field}: ${(m as { message: string }).message}`
            : String(m);
      const validationText = validationMessages ? validationMessages.map(formatMsg).join('; ') : null;
      const def = statusToErrorCode(status);
      const defaultMessage = pickMessage(def.message, lang);
      envelope = {
        code: def.code,
        message: validationText
          ? `${defaultMessage}: ${validationText}`
          : typeof body === 'string'
            ? body
            : ((body as { message?: string }).message ?? defaultMessage),
        data: validationMessages ? { fields: validationMessages } : null,
      };
    } else {
      this.logger.error(
        `未捕获异常 ${req.method} ${req.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      envelope = {
        code: ERROR_CODE.SYSTEM_ERROR.code,
        message: pickMessage(ERROR_CODE.SYSTEM_ERROR.message, lang),
        data: null,
      };
    }

    const httpStatus =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    res.status(httpStatus).json(envelope);
  }
}

/** HTTP 状态码 → 100xx 通用错误码映射（BizException 之外的所有 HttpException 走这里） */
function statusToErrorCode(status: number): { code: number; message: { zhCN: string; enUS: string } } {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return { code: ERROR_CODE.PARAM_INVALID.code, message: ERROR_CODE.PARAM_INVALID.message };
    case HttpStatus.UNAUTHORIZED:
      return { code: ERROR_CODE.UNAUTHORIZED.code, message: ERROR_CODE.UNAUTHORIZED.message };
    case HttpStatus.FORBIDDEN:
      return { code: ERROR_CODE.FORBIDDEN.code, message: ERROR_CODE.FORBIDDEN.message };
    case HttpStatus.NOT_FOUND:
      return { code: ERROR_CODE.NOT_FOUND.code, message: ERROR_CODE.NOT_FOUND.message };
    case HttpStatus.METHOD_NOT_ALLOWED:
      return { code: ERROR_CODE.METHOD_NOT_ALLOWED.code, message: ERROR_CODE.METHOD_NOT_ALLOWED.message };
    case HttpStatus.CONFLICT:
      return { code: ERROR_CODE.CONFLICT.code, message: ERROR_CODE.CONFLICT.message };
    case 429:
      return { code: ERROR_CODE.TOO_MANY_REQUESTS.code, message: ERROR_CODE.TOO_MANY_REQUESTS.message };
    default:
      return { code: ERROR_CODE.SYSTEM_ERROR.code, message: ERROR_CODE.SYSTEM_ERROR.message };
  }
}
