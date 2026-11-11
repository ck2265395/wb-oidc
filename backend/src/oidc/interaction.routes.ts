import { Router, Request, Response, NextFunction } from 'express';
import { LegacyUserService } from './legacy/legacy-user.service';
import { AppConfig } from '../config/env';
import { clearRateLimit, hitRateLimit } from '../common/rate-limiter';
import { ERROR_CODE, pickLang, pickMessage, ResponseLang } from '../common/error-code';

/** 统一响应信封（与全局异常过滤器一致） */
interface ErrorEnvelope {
  code: number;
  message: string;
  data: null;
}

/** 请求语言：language 头优先，回退 accept-language，最终 zh-CN（与全局过滤器一致） */
function reqLang(req: Request): ResponseLang {
  return pickLang(
    (req.headers['language'] as string | undefined) ?? req.headers['accept-language'],
  );
}

/** 按错误码定义输出多语言信封 */
function errorEnvelope(def: { code: number; httpStatus: number; message: { zhCN: string; enUS: string } }, lang: ResponseLang): ErrorEnvelope {
  return { code: def.code, message: pickMessage(def.message, lang), data: null };
}

/**
 * OIDC interaction 路由（挂载在 provider.callback 之前）：
 * - GET  /interaction/:uid          返回统一登录/授权 SPA 页面
 * - GET  /interaction/:uid/details  交互上下文（前端渲染用）
 * - POST /interaction/:uid/login    账号密码校验（走老系统）
 * - POST /interaction/:uid/confirm  用户同意授权，生成 grant
 */
export function interactionRouter(
  provider: any,
  legacyUserService: LegacyUserService,
  config: AppConfig,
  distDir: string,
): Router {
  const router = Router();

  const corsHandler = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  };

  router.use(corsHandler);

  // 账号密码登录
  router.post('/interaction/:uid/login', async (req, res, next) => {
    try {
      const { username, password, remember } = req.body || {};
      // 登录限流：同账号+IP 窗口期内限次，防撞库（阈值见 RATE_LIMIT_LOGIN_MAX）
      const rl = config.rateLimit;
      const loginKey = `oidclogin:${String(username || '').trim()}:${req.ip}`;
      if (!hitRateLimit(loginKey, rl.loginMax, rl.loginWindowMs)) {
        res.status(429).json(errorEnvelope(ERROR_CODE.TOO_MANY_REQUESTS, reqLang(req)));
        return;
      }
      const user = await legacyUserService.verifyLogin(
        String(username || ''),
        String(password || ''),
      );
      if (!user) {
        res.status(401).json(errorEnvelope(ERROR_CODE.AUTH_INVALID_CREDENTIALS, reqLang(req)));
        return;
      }
      clearRateLimit(loginKey);
      const result: any = {
        login: {
          accountId: user.id,
          remember: !!remember,
          ts: Math.floor(Date.now() / 1000),
        },
      };
      const redirectTo = await provider.interactionResult(req, res, result, {
        mergeWithLastSubmission: true,
      });
      res.json({ redirectTo });
    } catch (err) {
      next(err);
    }
  });

  // 同意授权
  router.post('/interaction/:uid/confirm', async (req, res, next) => {
    try {
      const details = (await provider.interactionDetails(req, res)) as any;
      const { params, session } = details;
      if (!session || !session.accountId) {
        res.status(401).json(errorEnvelope(ERROR_CODE.AUTH_SESSION_REVOKED, reqLang(req)));
        return;
      }
      const grant = new provider.Grant({
        accountId: session.accountId,
        clientId: params.client_id,
      });
      grant.addOIDCScope(params.scope || 'openid');
      const grantId = await grant.save();
      const redirectTo = await provider.interactionResult(
        req,
        res,
        { consent: { grantId } },
        { mergeWithLastSubmission: false },
      );
      res.json({ redirectTo });
    } catch (err) {
      next(err);
    }
  });

  // 交互上下文（JSON）
  router.get('/interaction/:uid/details', async (req, res, next) => {
    try {
      const details = (await provider.interactionDetails(req, res)) as any;
      const client = await provider.Client.find(details.params.client_id);
      res.json({
        uid: details.uid,
        prompt: { name: details.prompt.name, reasons: details.prompt.reasons },
        params: details.params,
        client: client
          ? { client_id: client.clientId, client_name: client.clientName }
          : { client_id: details.params.client_id, client_name: details.params.client_id },
        session: !!details.session,
      });
    } catch (err) {
      next(err);
    }
  });

  // 交互页面（SPA）
  router.get('/interaction/:uid', (_req, res) => {
    res.sendFile(`${distDir}/index.html`);
  });

  // 路由级错误兜底：next(err) 的未捕获异常也输出统一信封（10000），不落到 express 默认 HTML 错误页
  router.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    void err;
    res.status(500).json(errorEnvelope(ERROR_CODE.SYSTEM_ERROR, reqLang(req)));
  });

  return router;
}
