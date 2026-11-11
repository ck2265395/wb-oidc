import 'dotenv/config';
import 'reflect-metadata';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LegacyUserService } from './oidc/legacy/legacy-user.service';
import { createProvider } from './oidc/provider.factory';
import { interactionRouter } from './oidc/interaction.routes';
import { loadConfig } from './config/env';
import { closeDataSource, waitReady } from './db/data-source';
import { migratePlaintextSecrets } from './common/secret-migration';
import { startStateCleanup } from './common/state-cleanup';

const PROVIDER_PREFIXES = [
  '/auth',
  '/token',
  '/userinfo',
  '/jwks',
  '/session',
  '/.well-known',
  '/introspect',
  '/revocation',
];

const isProviderPath = (path: string): boolean =>
  PROVIDER_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  // 先跑迁移（建表）再接请求，避免首个请求与建表竞态
  await waitReady();
  // 存量明文 client_secret 一次性加密（幂等，主密钥未持久化时自动跳过）
  await migratePlaintextSecrets();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api');
  // 全局参数校验：自动按 DTO 装饰器校验/转换（class-validator 标准做法）
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false, // 不剥离未声明字段（分页/审核等 DTO 依赖原样透传的冗余字段）
      forbidNonWhitelisted: false,
      // 校验失败统一 400 JSON，不抛 HTML 错误页
      exceptionFactory: (errors) =>
        new BadRequestException(
          errors
            .map((e) => Object.values(e.constraints || {}).map((message) => ({ field: e.property, message })))
            .flat(),
        ),
    }),
  );
  app.enableCors({
    origin: config.corsOrigins.length ? config.corsOrigins : false,
    credentials: true,
  });

  // Swagger 仅本地/非生产开启，挂在 /api/docs（不与 OIDC 协议路径冲突）
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('wb-oidc API')
      .setDescription('OIDC Provider 管理端 / 开发者端 API')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'MOONDROP-OIDC API',
    });
  }

  const legacyUserService = app.get(LegacyUserService);
  const provider = createProvider(config, legacyUserService);

  const server = app.getHttpAdapter().getInstance() as express.Express;

  // 前端静态资源（frontend/dist）
  const distDir = path.resolve(__dirname, '../../frontend/dist');
  const hasDist = existsSync(path.join(distDir, 'index.html'));

  // 关键：以下中间件必须挂在 Nest 路由注册之前（app.init() 在 listen 时才注册路由）。
  // Nest 路由会对未匹配请求直接 404 终结，所以 OIDC 中间件要排在前面。

  // 0. 请求日志：方法 路径 状态码 耗时（控制台 + backend/logs/access.log 双写）
  const logDir = path.resolve(__dirname, '../logs');
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    /* 已存在或无权限时跳过文件日志 */
  }
  const logFile = path.join(logDir, 'access.log');
  // 追加写流：异步写盘，避免高并发下 appendFileSync 阻塞事件循环
  const logStream = createWriteStream(logFile, { flags: 'a' });
  logStream.on('error', () => {
    /* 文件日志失败不影响请求 */
  });
  const appendLog = (line: string) => {
    // eslint-disable-next-line no-console
    console.log(line);
    logStream.write(line + '\n');
  };
  server.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      appendLog(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - start}ms`,
      );
    });
    next();
  });

  // 1. body 解析（interaction 路由需要读 JSON body）
  server.use(express.json({ limit: '1mb' }));
  server.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 2. OIDC interaction 路由（登录/授权交互）
  server.use(interactionRouter(provider, legacyUserService, config, distDir));

  // 3. SPA 静态资源与 history 回退
  if (hasDist) {
    server.use(express.static(distDir));
    server.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET') return next();
      if (isProviderPath(req.path)) return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/interaction')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn('[boot] 未找到 frontend/dist，请先执行 cd frontend && npm run build');
  }

  // 4. OIDC 协议端点闸门：只有协议路径交给 provider，其余放行给 Nest（/api/*）
  //    注意 provider.callback() 返回 koa handler，必须以 this=provider 调用后再执行
  const oidcHandler = provider.callback();
  server.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isProviderPath(req.path)) {
      oidcHandler(req, res, next);
    } else {
      next();
    }
  });

  await app.listen(config.port);
  // 定时清理过期协议状态（Session/Grant/Token 等，防止 state 表无限膨胀）
  startStateCleanup();
  // eslint-disable-next-line no-console
  console.log(`[boot] OIDC Provider ready: ${config.issuer}`);
  // eslint-disable-next-line no-console
  console.log(`[boot] discovery: ${config.issuer}/.well-known/openid-configuration`);
  // eslint-disable-next-line no-console
  console.log(`[boot] admin api: ${config.issuer}/api/admin/clients（Bearer token 鉴权）`);

  // 优雅停机
  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[shutdown] 收到 ${signal}，正在关闭...`);
    await app.close();
    await closeDataSource();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot] 启动失败:', err);
  process.exit(1);
});
