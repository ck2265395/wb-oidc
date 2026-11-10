import { Router, Request, Response, NextFunction } from 'express';
import { LegacyUserService } from './legacy/legacy-user.service';
import { AppConfig } from '../config/env';
import { clearRateLimit, hitRateLimit } from '../common/rate-limiter';

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
        res.status(429).json({
          error: 'too_many_attempts',
          message: '登录尝试过于频繁，请稍后再试',
        });
        return;
      }
      const user = await legacyUserService.verifyLogin(
        String(username || ''),
        String(password || ''),
      );
      if (!user) {
        res.status(401).json({
          error: 'invalid_credentials',
          message: '用户名或密码错误',
        });
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
        res.status(400).json({ error: 'session_missing', message: '登录会话已失效，请重新登录' });
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

  return router;
}
