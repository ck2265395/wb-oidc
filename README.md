# wb-oidc — C 端 OIDC 统一认证系统

前后端分离的 OIDC Provider，让第三方应用接入你的存量注册用户登录。

- **后端**：NestJS + `oidc-provider`（OpenID 官方认证库）+ PostgreSQL（授权数据）+ 只读连老系统 PostgreSQL 校验存量用户
- **前端**：Vue3 + element-plus — 开放平台门户（根路径直达）、登录后工作台、Element Plus 管理后台（分组菜单 / 待办角标 / 统计卡）、统一登录页、授权确认页、PKCE 回调演示页

## 目录结构

```
wb-oidc/
├── backend/                 # NestJS 服务（端口 3000，含前端静态托管）
│   ├── src/
│   │   ├── main.ts              # 入口：挂载 OIDC 中间件 + interaction 路由 + SPA
│   │   ├── config/env.ts        # 环境变量集中校验（启动即失败）
│   │   ├── db/
│   │   │   ├── data-source.ts   # TypeORM DataSource 单例（启动自动跑迁移）
│   │   │   ├── entities.ts      # 7 张表实体（clients/state/admin/session/log/developer/...）
│   │   │   └── migrations/      # TypeORM 迁移（全新建表，不用 synchronize）
│   │   ├── common/              # 密钥加密、审计工具、登录限流、过期状态清理
│   │   ├── oidc/
│   │   │   ├── provider.factory.ts   # oidc-provider 配置（PKCE 默认、RS256、claims）
│   │   │   ├── pg.adapter.ts         # 会话/code/token/grant 持久化到 PG
│   │   │   ├── interaction.routes.ts # 登录/授权页数据与提交端点
│   │   │   └── legacy/legacy-user.service.ts  # 老库用户校验（bcrypt/md5/sha1/...，只读连老系统 PG）
│   │   ├── clients/             # 第三方应用管理（注册/密钥/回调白名单/启停/审核）
│   │   ├── admin/               # 管理员鉴权、账号管理、审计、运营查询（概览/会话/老库）
│   │   ├── developer/           # 开发者门户后端（注册/登录/资格申请/应用申请/审核）
│   │   └── health/health.controller.ts
│   └── scripts/
│       ├── seed.mjs             # 跑迁移建表 + 注册示例应用 + 首个超管（需先 npm run build）
│       ├── verify-legacy.mjs    # 探测老库密码算法
│       ├── smoke-all.mjs        # 全链路冒烟（46 项断言）
│       └── smoke-profile.mjs    # 资料编辑链路冒烟（14 项断言）
├── frontend/
│   └── src/
│       ├── views/
│       │   ├── InteractionView.vue      # 统一登录页 / consent 授权页
│       │   ├── ConsoleView.vue          # 管理控制台布局
│       │   ├── console/                 # 概览/应用/用户与开发者/管理员/审计/会话/老库用户
│       │   ├── developer/               # 开发者门户（登录注册/工作台/接入文档）
│       │   ├── LoginView.vue            # 管理员登录
│       │   └── CallbackView.vue         # PKCE 回调演示（code → token → userinfo）
│       └── api/
│           ├── index.ts                 # 管理端 API（内存 token + 静默续期）
│           └── dev.ts                   # 开发者门户 API（独立 token，互不串）
└── docker-compose.yml       # PostgreSQL 5432 + 老库模拟 PG 5433
```

## 快速开始

### 1. 准备数据库

```bash
# 方式一：docker 起 PG（老库模拟实例可选，直连真实老库时不需要）
docker compose up -d

# 方式二：用本地已有的 PostgreSQL，手动建库
psql -U postgres -c "CREATE DATABASE wb_oidc"
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env：PG 账号密码、老系统 PostgreSQL 连接、LEGACY_* 字段映射、改掉两个 please-change-me
```

### 3. 初始化表和示例应用

```bash
cd backend
npm run build                     # seed 依赖 dist 产物（实体/迁移），需先构建
npm run seed
# 成功后输出示例 client：wb-demo-spa / secret
```

数据表由 TypeORM migrations 管理（启动时 `migrationsRun` 自动应用新迁移，`synchronize` 关闭）。常用命令：

```bash
npm run db:reinit       # 一键全量初始化：清空全部表 → 重跑迁移 → 重新 seed（危险：数据全丢）
npm run migration:show  # 查看迁移状态
npm run migration:run   # 手动应用未执行的迁移
npm run migration:revert  # 回滚最近一次迁移
```

### 3.1 确认老库密码算法（建议先跑一次）

老库密码算法不是猜的，用真实测试账号跑一遍即可确认：

```bash
cd backend
node scripts/verify-legacy.mjs <用户名> <密码>
```

脚本会连老库取该用户记录，依次尝试 HMAC-SHA256/SHA-256/MD5/SHA-1（hex 与 base64 两种输出）和 bcrypt，输出匹配的算法与应写入 `.env` 的配置项。

已实测（moondrop 老库）：

| 项 | 值 |
|---|---|
| 库 | `moondrop-service-test`（与授权库同一 PG 实例） |
| 用户表 | `USER`（大写，PG 需 `"USER"` 引用） |
| 主键 | `uuid`（推荐作为 OIDC `sub`） |
| 密码字段 | `password`，44 位 base64 |
| 算法 | `LEGACY_PASSWORD_HASH=hmac-sha256-b64` + `LEGACY_HMAC_KEY=moondropapp&&` |
| 状态 | `LEGACY_STATUS_FIELD=status`，`LEGACY_STATUS_ACTIVE=1` |
| 头像 | `profilepic` |

### 4. 构建并启动

```bash
# 后端
cd backend && npm install && npm run build
npm run start   # 或 node dist/main.js

# 前端（构建产物由后端静态托管，访问 http://localhost:3000/console）
cd frontend && npm install && npm run build
```

开发模式前端可单独跑 `npm run dev`（Vite，5173），已配代理到后端。

## 接入流程（第三方应用视角）

两条路：**自助门户**（推荐给第三方）或**管理端直接建**（平台内部/联调）。

### A. 开发者门户自助接入

1. 打开 `/developer/login` → **注册（只需邮箱 + 密码）→ 立即可以登录**，此时是普通用户（`developer_status=none`），可浏览首页与接入文档
2. 登录后进入 `/apps` **工作台**，两个模块常显：**用户资料与状态**（账号状态、开发者资格、资料字段、审核进度，右上角可「编辑开发者资料」）+ **我的应用列表**（普通用户为空列表）
3. 资料维护走**整页表单** `/profile/edit`（工作台模块一或 `/profile` 账号资料页的「编辑开发者资料」都跳到这里）——可「仅保存资料」（不改变资格）或「保存并提交审核」。填写**公司 / 团队 + 联系方式 + 个人/企业类型**提交后 `developer_status=pending`；审核中可继续改资料，被驳回可改资料重提。点「新建应用」时先做资格检测，未认证会跳到这里补充资料
4. 管理员在控制台「**开发者审核**」页审核资格（左侧菜单有待审数量角标、顶栏有待办入口）：通过 → `approved`；驳回（填理由）→ `rejected`
5. **资格 `approved` 后点「新建应用」跳到 `/apps/new` 整页创建表单**：填写名称 / 类目 / 图标 / 简介 / 官网 / 回调 / ICP / 标签 / scopes 并勾选开发者协议 → 应用 `pending`，此时无法发起授权；创建成功页展示 `client_id` / `client_secret`，之后在「编辑应用 → 接入配置」中可随时重新查看（需验证登录密码）
6. 管理员在「应用管理」审核通过 → 应用 `approved`，可正常走 OIDC；编辑应用走 `/apps/:clientId/edit` 整页表单，修改**回调地址或 scope** → 自动回到 `pending` 重新审核（名称改动不触发）

> **表单一律整页**：编辑开发者资料、新建应用、编辑应用都是独立路由页（`/profile/edit`、`/apps/new`、`/apps/:clientId/edit`），不再用弹窗——字段多时可完整展示、可刷新、不易误关。

> 账号状态（能否登录）与开发者资格（能否建应用）是两个独立字段；创建应用时服务端**实时查库**校验资格，不依赖 JWT 里签发的旧状态。应用列表接口不校验资格，普通用户也能正常看到空列表。

> **应用类目与分组**：创建应用需选择类目 `category`（`web_app` 网站应用 / `mobile_app` 移动应用 / `mini_program` 小程序），类目同时决定安全形态（网站应用发 `client_secret`，移动/小程序走 PKCE 且**不下发** secret）。列表页可按类目筛选；另提供自由 `tags`（最多 20 个）做任意归类，暂不做独立分组管理 UI（应用量上来再升级独立分组表）。**个人 / 企业开发者**：`developer_type` 区分 `personal` / `enterprise`；**企业开发者创建或编辑应用时必须保留 ICP 备案号 `icp_number`**（参照 QQ 开放平台中国合规要求），个人开发者与管理端创建不强制。应用元数据字段：`logo`（≤100×100 图标 data URL）、`description`（≤200 字自动截断）、`website`（官网域名，需 http(s)://）。

> **client_secret 存储与查看**：`oidc_clients.client_secret` 落库前用 **AES-256-GCM 加密**（`enc:v1:<iv>:<tag>:<cipher>`），不是明文也不是哈希——因为平台允许开发者随时查看自己的密钥。查看走 `POST /api/developer/apps/:clientId/reveal-secret`，**必须重新输入登录密码**，每次查看（含失败）都写 `oidc_admin_log` 审计日志（`action=developer.reveal_secret[.failed]`，`username=developer:<邮箱>`）。
>
> 主密钥优先级：环境变量 `CLIENT_SECRET_KEY`（32 字节 hex/base64，**生产必须显式设置**）> `backend/.secret-key` 文件（首次启动自动生成、已在 .gitignore）。主密钥要与数据库**分开保管**，否则加密失去意义。主密钥无法持久化时，启动会跳过存量加密迁移并告警，避免把可用数据变成解不开的密文。
>
> 历史明文数据在启动时由 `migratePlaintextSecrets()` 幂等迁移为密文；读取侧 `decryptSecret()` 对无前缀的旧值原样返回，保证灰度期兼容。轮换接口（`POST /api/admin/clients/:clientId/rotate-secret`）仍保留，用于密钥外泄后的止损，**立即失效**（无新旧并存过渡期）。

### B. 管理端直接注册

登录控制台（`/console`）或调用 `POST /api/admin/clients`（Bearer token），拿到 `client_id`（SPA/PKCE 客户端可不发 secret），应用直接 `approved`。

### C. 发起授权

1. 302 跳转

   ```
   GET /auth?client_id=xxx&response_type=code
      &scope=openid profile&redirect_uri=回调白名单地址
      &code_challenge=<S256>&code_challenge_method=S256&state=随机串
   ```

2. **用户登录 + 授权**：跳到你域名下的统一登录页（`/interaction/:uid`，Vue 页面），用**老系统的账号密码**登录 → consent 页确认 → 发 code。
3. **换 token**：后端用 code 换 `id_token + access_token + refresh_token`。

   ```
   POST /token  grant_type=authorization_code&code=...&client_id=...&code_verifier=...
   ```

4. **拿用户信息**：`GET /userinfo`（Bearer access_token）→ sub / nickname / email / phone / avatar。
5. **演示**：本仓库前端自带完整演示，访问 `http://localhost:3000/callback?start=1` 一键走完 PKCE 流程。

## 管理端登录与 API

管理端不再使用静态 `x-admin-key`，而是**独立管理员表 + 账号密码登录**：

| 表 | 用途 |
|---|---|
| `oidc_admin` | 管理员账号（bcrypt 密码、角色 `super_admin` / `operator`、启停） |
| `oidc_admin_session` | refresh token（只存 SHA-256 哈希，刷新即轮换、可单独吊销） |
| `oidc_admin_log` | 操作审计（谁、何时、哪个 IP、对哪个应用做了什么） |

登录流程：

1. `POST /api/admin/auth/login` `{username,password}` → 返回 15 分钟 `access_token`（前端只放内存）+ `httpOnly` 刷新 cookie（7 天）
2. 之后所有管理请求带 `Authorization: Bearer <access_token>`
3. access token 过期 → 前端自动调 `POST /api/admin/auth/refresh` 续期并重放原请求
4. `POST /api/admin/auth/logout` 吊销刷新令牌
5. `POST /api/admin/auth/change-password` 自助改密码（校验原密码，成功后吊销全部会话）

**改自己的密码**：登录控制台 → 右上角「修改密码」→ 填原密码 + 新密码（至少 10 位、含字母和数字）。改完所有设备都会退出，用新密码重新登录即可。忘记密码则用 `npm run reset-admin -- <用户名>` 重置。

首次使用：

```bash
cd backend
npm run seed                      # 建表 + 示例客户端 + 首个超级管理员
npm run reset-admin -- admin      # 忘记密码时重置，凭据写入 backend/.admin-credentials.txt
npm run smoke:admin -- http://127.0.0.1:3000    # 鉴权链路冒烟（9 项断言）
npm run smoke:password -- http://127.0.0.1:3000 # 改密码链路冒烟（9 项断言，测完自动恢复原密码）
npm run smoke:all -- http://127.0.0.1:3200      # 全链路冒烟：开发者门户 + 审核 + OIDC + 审计/会话/老库（46 项）
npm run smoke:profile -- http://127.0.0.1:3200  # 资料编辑链路冒烟：仅保存 / 审核中改 / 已认证改（14 项）
npm run smoke:app-meta -- http://127.0.0.1:3200  # 应用元数据 / 个人企业开发者冒烟（17 项：企业 ICP 强制、类目派生、简介截断、官网校验）
npm run smoke:secret -- http://127.0.0.1:3200   # 密钥加密与查看冒烟（20 项：密文落库、二次验证、归属校验、token 端点认证、审计）
```

管理员接口（需 `super_admin`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/auth/me` | 当前登录管理员 |
| POST | `/api/admin/auth/change-password` | 修改**自己**的密码 `{old_password,new_password}` |
| GET | `/api/admin/users` | 管理员列表 |
| POST | `/api/admin/users` | 新建管理员 `{username,password,display_name,role}` |
| PATCH | `/api/admin/users/:id` | 改显示名/角色/启停 |
| POST | `/api/admin/users/:id/reset-password` | 重置**他人**密码（并吊销该账号所有会话） |

应用管理接口（任何已登录管理员）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/clients` | 列表（含申请人邮箱与审核状态） |
| POST | `/api/admin/clients` | 注册应用 `{ client_name, redirect_uris, application_type, category, logo, description, website, icp_number, tags, scope }` |
| GET | `/api/admin/clients/:clientId` | 详情 |
| PATCH | `/api/admin/clients/:clientId/enabled/:enabled` | 启停 |
| PATCH | `/api/admin/clients/:clientId` | 编辑名称/回调/scope/类目/图标/简介/官网/ICP/标签 |
| POST | `/api/admin/clients/:clientId/review` | 审核 `{ action: approve\|reject\|suspend, reason }` |
| POST | `/api/admin/clients/:clientId/rotate-secret` | 轮换 secret |
| DELETE | `/api/admin/clients/:clientId` | 删除 |
| GET | `/api/admin/developers` | 用户/开发者列表（按 `status=none\|pending\|approved\|rejected\|suspended` 过滤，仅超管） |
| PATCH | `/api/admin/developers/:id/review` | 审核开发者资格 `{ action: approve\|reject, reason }` |
| PATCH | `/api/admin/developers/:id/status` | 账号启停 `{ status: active\|suspended, reason }` |
| GET | `/api/admin/logs` | 审计日志（page/size/action/username） |
| GET | `/api/admin/overview` | 概览统计（应用/开发者/会话/老库用户数 + 最近操作） |
| GET | `/api/admin/sessions` | OIDC 终端用户会话列表 |
| DELETE | `/api/admin/sessions/:id` | 吊销会话 |
| GET | `/api/admin/legacy-users` | 老库用户只读查询（keyword/page/size，密码脱敏） |

开发者门户接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/developer/auth/register` | 注册 `{ email, password }` → 立即 `active` 可登录，资格 `none` |
| POST | `/api/developer/auth/login` | 登录（仅 `active` 账号，独立 cookie） |
| GET | `/api/developer/auth/me` | 当前用户（含账号状态 / 开发者资格 / 驳回原因 / 申请时间） |
| PATCH | `/api/developer/profile` | 编辑开发者资料 `{ company, contact, developer_type }`，**不改变资格状态**（任何 `active` 用户可用） |
| POST | `/api/developer/apply` | 补充开发者资料并提交审核 `{ company, contact, developer_type }` → `pending`（仅 `none` / `rejected` 可提交） |
| GET | `/api/developer/apps` | 我的应用列表（不校验资格，普通用户返回空列表） |
| POST | `/api/developer/apps` | 提交应用申请 `{ client_name, redirect_uris, category, logo, description, website, icp_number, tags }` → `pending`（**需资格 `approved`**，否则 403；**企业开发者必填 `icp_number`**） |
| PATCH | `/api/developer/apps/:clientId` | 编辑（可改类目/图标/简介/官网/ICP/标签；改回调/scope 自动回 `pending`；**企业开发者清空 ICP 被拒**） |
| POST | `/api/developer/apps/:clientId/reveal-secret` | 查看 `client_secret` 明文 `{ password }`：缺密码 400、密码错 401、PKCE 应用返回 `null`；均在 `oidc_admin_log` 留痕 |

全链路冒烟（`smoke:all` 46 项 + `smoke:profile` 14 项，自带临时超管 / 临时用户并在结束后清理数据）：

```bash
cd backend && npm run build
PORT=3200 node dist/main.js &
node scripts/smoke-all.mjs http://localhost:3200
```

## 安全要点（已实现 / 待上线加固）

已实现：
- 默认 `authorization_code + PKCE`，隐式/密码 flow 未开放
- 回调 URL 严格白名单、client 启停开关、secret 轮换
- id_token RS256 签名（jwks 自动发现 `/.well-known/openid-configuration`）
- refresh token 轮换（oidc-provider 内建）
- 老库只读访问，不碰老系统写接口
- 管理端独立账号体系：bcrypt 密码、access token 仅内存持有、refresh token httpOnly + 服务端哈希存储、改密即吊销全部会话、操作审计

上线前还需要：
- [ ] `ISSUER` 换成正式 https 域名；全部走 HTTPS
- [ ] `ADMIN_JWT_SECRET` / `OIDC_COOKIE_SECRET` 换成强随机值（当前已随机生成，仍需按环境隔离），密钥用 KMS 或至少定期轮换
- [ ] `ADMIN_COOKIE_SECURE=true`（https 环境）
- [ ] 登录加图形/短信验证码（失败限流已内置：`RATE_LIMIT_LOGIN_MAX`/`RATE_LIMIT_LOGIN_WINDOW_MS`，默认 15 分钟 10 次/账号+IP）
- [ ] 管理员操作审计接入日志平台，保留 ≥ 180 天
- [ ] **`CLIENT_SECRET_KEY` 与数据库分开备份**：密钥丢了，库里已加密的 `client_secret` 全部无法恢复（可申请轮换，但会中断第三方接入）
- [ ] 老系统若支持改密/注销，补充 back-channel logout
- [ ] PG 数据库备份策略（adapter 表过期状态由启动的定时清理任务每小时自动清理）

## 常见问题

- **3000 端口被占用**：改 `.env` 的 `PORT`，同时 `ISSUER` 保持与实际访问域名一致（discovery 端点按请求 Host 动态生成，issuer 决定 token 校验）。
- **登录报「老系统连接失败」**：检查 `LEGACY_DB_*` 与 `LEGACY_USER_TABLE` / 密码哈希算法配置是否与老库一致。
- **第三方换 token 报 invalid_grant**：code 一次性且 10 分钟过期，检查是否重复使用；PKCE verifier 要和 challenge 配对。
